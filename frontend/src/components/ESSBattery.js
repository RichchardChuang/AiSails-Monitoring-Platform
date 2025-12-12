import React, { useState } from 'react';
import { Battery, Power, Thermometer, Zap, Activity, Settings, ToggleLeft, ToggleRight, AlertTriangle, RefreshCw } from 'lucide-react';

const ESSBattery = ({ realTimeData, setRealTimeData, handleCommandExecute, isDarkMode }) => {
  const [activeTab, setActiveTab] = useState('pcs');
  const [isAdmin] = useState(true); // TODO: 從權限管理系統獲取
  const [isExecuting, setIsExecuting] = useState(false);
  const [editingValues, setEditingValues] = useState({}); // 儲存編輯中的值

  const essData = realTimeData.ess;

  // 初始化 editingValues，確保頻率輸入框有初始值
  React.useEffect(() => {
    if (editingValues['pcs_frequency'] === undefined && essData.pcs.frequency) {
      setEditingValues(prev => ({
        ...prev,
        ['pcs_frequency']: essData.pcs.frequency
      }));
    }
  }, [essData.pcs.frequency, editingValues]);

  // 發送命令到後端並記錄 log
  const sendCommand = async (device, action, description) => {
    setIsExecuting(true);
    try {
      const response = await fetch('/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device, action })
      });
      
      const result = await response.json();
      
      // 如果父組件提供了 handleCommandExecute callback，呼叫它
      if (handleCommandExecute) {
        handleCommandExecute({
          device,
          action,
          success: response.ok,
          message: result.message || result.error,
          description
        });
      }
      
      return response.ok;
    } catch (error) {
      console.error('Error sending command:', error);
      if (handleCommandExecute) {
        handleCommandExecute({
          device,
          action,
          success: false,
          message: 'Unable to connect to backend service',
          description
        });
      }
      return false;
    } finally {
      setIsExecuting(false);
    }
  };

  const toggleESSSwitch = async () => {
    const newState = !essData.switch;
    const action = newState ? 'run_microgrid' : 'stop_microgrid';
    const description = newState ? 'ESS Battery 系統開啟' : 'ESS Battery 系統關閉';
    
    // 先發送命令到後端
    const success = await sendCommand('sbms', action, description);
    
    // 如果成功，更新本地狀態
    if (success) {
      setRealTimeData(prev => ({
        ...prev,
        ess: {
          ...prev.ess,
          switch: newState,
          status: newState ? 'active' : 'inactive'
        }
      }));
    }
  };

  const handleValueChange = (category, field, value) => {
    setRealTimeData(prev => ({
      ...prev,
      ess: {
        ...prev.ess,
        [category]: {
          ...prev.ess[category],
          [field]: value || 0
        }
      }
    }));
  };

const frequencyReset = async (category, field, InputValue) => {
  setRealTimeData(prev => ({
    ...prev,
    ess: {
      ...prev.ess,
      [category]: {
        ...prev.ess[category],
        [field]: InputValue
      }
    }
  }));
  // 同時更新 editingValues
  setEditingValues(prev => ({
    ...prev,
    [`${category}_${field}`]: InputValue
  }));
  // 發送命令到後端
  await sendCommand(category, "pcs_freq_reset", `調整頻率重置為${InputValue}Hz`);
};

const handleFrequencySubmit = async () => {
  const key = 'pcs_frequency';
  const currentValue = editingValues[key] !== undefined ? editingValues[key] : essData.pcs.frequency;
  const originalValue = essData.pcs.frequency;

  // 檢查數值範圍
  if (currentValue < 59.77) {
    alert('頻率值太低！請設定在 59.77-60 Hz 之間');
    setEditingValues(prev => ({
      ...prev,
      [key]: essData.pcs.frequency
    }));
    return;
  }
  if (currentValue > 60) {
    alert('頻率值太高！請設定在 59.77-60 Hz 之間');
    setEditingValues(prev => ({
      ...prev,
      [key]: essData.pcs.frequency
    }));
    return;
  }

  // 判斷調整方向
  let action;
  if (currentValue > originalValue) {
    action = 'pcs_freq_up';
  } else if (currentValue < originalValue) {
    action = 'pcs_freq_down';
  } else {
    alert('頻率值未改變');
    return;
  }

  // 發送命令到後端
  await sendCommand('pcs', action, `調整頻率為${currentValue.toFixed(2)}Hz`);

  // 更新 realTimeData
  handleValueChange('pcs', 'frequency', currentValue);
};

  const MetricCard = ({ title, value, unit, status, icon: Icon, isSwitch = false, onToggle, className = "", editable = false, category = "", field = "" }) => (
    <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border hover:shadow-md transition-all duration-300 ${className}`}>
        {status && (
          <span className={`px-2 py-1 right-0 rounded-full text-[0.65rem] font-medium whitespace-nowrap flex-shrink-0 self-start ${
            status === 'activate' || status.toUpperCase() === 'CHARGE' || status === 'normal' || status === 'Running' ? 'bg-green-100 text-green-800' :
            status === 'charging' || status.toUpperCase() === 'DISCHARGE' ? 'bg-blue-100 text-blue-800' :
            status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
            status === 'offline' || status === 'OFFLINE' ? 'bg-red-100 text-red-800 font-semibold' :
            'bg-gray-200 text-gray-800'
          }`}>
            {status.toUpperCase()}
          </span>
        )}
      <div className="flex items-start justify-between mb-4 mt-3 gap-2">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <div className={`p-2 ${isDarkMode ? 'bg-blue-900/50' : 'bg-blue-50'} rounded-lg flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <h3 className={`text-xs md:text-sm xl:text-base font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'} truncate`}>{title}</h3>
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          {isSwitch ? (
            <button
              onClick={onToggle}
              disabled={!isAdmin || isExecuting}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                value ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
              } ${(!isAdmin || isExecuting) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {value ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              <span className="font-medium text-xl">{value ? 'RUN' : 'STOP'}</span>
            </button>
          ) : (
            <div className="flex items-baseline space-x-1">
              <span className={`font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'} ${category === 'pcs' && field === 'frequency' ? 'text-xl xl:text-2xl' : 'text-xl xl:text-2xl'}`}>
                {typeof value === 'number' ?(category === 'pcs' && field === 'frequency' ? value.toFixed(2) : value.toFixed(1)): value}
              </span>
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{unit}</span>
              {editable && !isAdmin && (
                <span className="text-xs text-gray-400 ml-2">(唯讀)</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const UPSSystem = () => (
    <div className="space-y-6">
      <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border`}>
        <h3 className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>UPS 系統監控</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className={`flex justify-between items-center p-3 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg`}>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>UPS狀態</span>
              <span className={`font-medium ${essData.ups?.ups_status === 'Running' ? 'text-green-600' : isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {essData.ups?.ups_status || 'N/A'}
              </span>
            </div>
            <div className={`flex justify-between items-center p-3 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg`}>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>輸入電壓</span>
              <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{(essData.ups?.ups_involtage || 0).toFixed(1)} V</span>
            </div>
            <div className={`flex justify-between items-center p-3 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg`}>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>輸出電壓</span>
              <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{(essData.ups?.ups_outvoltage || 0).toFixed(1)} V</span>
            </div>
            <div className={`flex justify-between items-center p-3 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg`}>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>負載百分比</span>
              <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{(essData.ups?.ups_loadpercent || 0).toFixed(1)}%</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className={`flex justify-between items-center p-3 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg`}>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>電池電壓</span>
              <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{(essData.ups?.ups_batteryvoltage || 0).toFixed(1)} V</span>
            </div>
            <div className={`flex justify-between items-center p-3 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg`}>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>輸出電流</span>
              <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{(essData.ups?.ups_outcurrent || 0).toFixed(1)} A</span>
            </div>
            <div className={`flex justify-between items-center p-3 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg`}>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>輸出功率</span>
              <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{(essData.ups?.ups_outpower || 0).toFixed(1)} W</span>
            </div>
            <div className={`flex justify-between items-center p-3 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg`}>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>電池容量</span>
              <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{(essData.ups?.ups_capacity || 0).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* UPS 負載趨勢 */}
        <div className="mt-6">
          <h4 className={`font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-900'} mb-4`}>UPS 負載趨勢</h4>
          <div className={`h-32 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg p-4`}>
            <svg className="w-full h-full" viewBox="0 0 300 80">
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                points={Array.from({length: 20}, (_, i) => {
                  const x = (i * 300) / 19;
                  const y = 60 - ((essData.soc || 90) / 100 * 50) + (Math.random() - 0.5) * 10;
                  return `${x},${y}`;
                }).join(' ')}
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );

  const AirConSystem = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-6 xl:gap-3">
        <MetricCard
          title="運行狀態"
          value={essData.aircon.status}
          icon={Activity}
          status={essData.aircon.status === 'Running' ? 'activate' : 'offline'}
        />
        <MetricCard
          title="室溫"
          value={essData.aircon.temperature}
          unit="°C"
          icon={Thermometer}
          status={essData.aircon.temperature === 0 ? 'inactive' : 'normal'}
        />
        <MetricCard
          title="溫度設定"
          value={essData.aircon.temperature}
          unit="°C"
          icon={Thermometer}
          status={essData.aircon.temperature === 0 ? 'inactive' : 'normal'}
        />
        <MetricCard
          title="濕度"
          value={essData.aircon.humidity}
          unit="%"
          icon={Thermometer}
          status={essData.aircon.humidity === 0 ? 'inactive' : 'normal'}
        />
        <MetricCard
          title="模式"
          value={essData.aircon.mode}
          icon={Settings}
          status={essData.aircon.mode === 'Idle' ? 'inactive' : 'normal'}
        />
      </div>

      {/* <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-6">空調系統控制</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 mb-3">當前狀態</h4>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">狀態</span>
              <span className="font-medium text-green-600">{essData.aircon.status}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">目標溫度</span>
              <span className="font-medium">{essData.aircon.temperature}°C</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">當前模式</span>
              <span className="font-medium">{essData.aircon.mode}</span>
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 mb-3">系統參數</h4>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">風速</span>
              <span className="font-medium">中速</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">濕度</span>
              <span className="font-medium">45%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">功耗</span>
              <span className="font-medium">2.5 kW</span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h4 className="font-medium text-gray-900 mb-4">溫度監控</h4>
          <div className="relative">
            <div className="flex items-center justify-center">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                  <circle 
                    cx="50" cy="50" r="40" fill="none" 
                    stroke="#10b981" strokeWidth="8"
                    strokeDasharray={`${(essData.aircon.temperature / 10) * 251} 251`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-xl font-bold text-gray-900">{essData.aircon.temperature}°C</span>
                  <span className="text-xs text-gray-500">目標溫度</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div> */}
    </div>
  );

  const PCSSystem = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 電力參數 (Power & Voltage) */}
        <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border`}>
          <h3 className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>電力參數</h3>
          <div className="space-y-4">
            <div className={`flex justify-between items-center p-3 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg`}>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>偵測電壓</span>
              <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{essData.pcs.lineVoltage || 0} V</span>
            </div>
            <div className={`flex justify-between items-center p-3 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg`}>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>輸出功率</span>
              <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{(essData.pcs.power || 0).toFixed(2)} kW</span>
            </div>
            <div className={`flex justify-between items-center p-3 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg`}>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>DC-Link電壓</span>
              <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{essData.pcs.dcLinkVoltage || 0} V</span>
            </div>
          </div>
        </div>

        {/* 頻率參數 (Frequency) */}
        <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border`}>
          <h3 className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>頻率參數</h3>
          <div className="space-y-4">

            <div className={`flex justify-between items-center p-3 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg`}>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>輸出頻率</span>
              <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{(essData.pcs.supplyFrequency || 0).toFixed(2)} Hz</span>
            </div>
            <div className={`flex justify-between items-center p-3 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg`}>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>偵測頻率</span>
              <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{(essData.pcs.lineFrequency || 0).toFixed(2)} Hz</span>
            </div>
          </div>
        </div>

        {/* 系統狀態 (System Status) */}
        <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border`}>
          <h3 className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>系統狀態</h3>
          <div className="space-y-4">
            <div className={`flex justify-between items-center p-3 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg`}>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>溫度</span>
              <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{(essData.pcs.temperature || 0).toFixed(1)} °C</span>
            </div>
            <div className={`flex justify-between items-center p-3 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg`}>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>故障狀態</span>
              <span className={`font-medium ${essData.pcs.fault === 'Not found' ?'text-green-600':'text-red-600'}`}>
                {essData.pcs.fault || 'Not found'}
              </span>
            </div>
            <div className={`flex justify-between items-center p-3 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg`}>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>模式</span>
              <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{essData.pcs.operatingMode || 'NaN'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'pcs', label: 'PCS', component: PCSSystem },
    { id: 'ups', label: 'UPS', component: UPSSystem },
    { id: 'aircon', label: '空調', component: AirConSystem }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || UPSSystem;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-600 to-green-800 rounded-xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">ESS Battery System</h2>
        <p className="text-green-100">儲能系統監控與管理</p>
      </div>

      {/* ESS Battery 系統控制 與 PCS 頻率控制並排 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左側 - ESS Battery 系統控制 */}
        <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border`}>
          <h3 className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>ESS Battery 系統控制</h3>

          {/* ESS 開關 with 負載儀表板 */}
          <div className="mb-6">
            <div className={`${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border hover:shadow-md transition-all duration-300`}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 左側 - ESS 開關 */}
                <div>
                  <span className={`px-2 py-1 rounded-full text-[0.65rem] font-medium whitespace-nowrap ${
                    (essData.switch || essData.ups?.switch) ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-800'
                  }`}>
                    {(essData.switch || essData.ups?.switch) ? 'ACTIVATE' : 'INACTIVE'}
                  </span>
                  <div className="flex items-start justify-between mt-3">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 ${isDarkMode ? 'bg-blue-900/50' : 'bg-blue-50'} rounded-lg`}>
                        <Power className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                      </div>
                      <div>
                        <h3 className={`text-sm xl:text-base font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>電網建立 (ESS)</h3>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    {/* <button
                      onClick={toggleESSSwitch}
                      disabled={!isAdmin || isExecuting}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                        (essData.switch || essData.ups?.switch) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                      } ${(!isAdmin || isExecuting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {(essData.switch || essData.ups?.switch) ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      <span className="font-medium text-xl">{(essData.switch || essData.ups?.switch) ? 'RUN' : 'STOP'}</span>
                    </button> */}
                  </div>
                </div>

                {/* 右側 - 負載儀表板 */}
                <div className="flex flex-col items-center justify-center">
                  <div className="relative w-52 h-32">
                    <svg className="w-full h-full" viewBox="0 0 220 120">
                      {/* 背景半圓 - 灰色底 */}
                      <path
                        d="M 30 100 A 80 80 0 0 1 190 100"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="8"
                        strokeLinecap="round"
                      />

                      {/* 彩色區域 - 紅色 (0-20%) */}
                      <path
                        d="M 30 100 A 80 80 0 0 1 45 54"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="8"
                        strokeLinecap="butt"
                      />
                      {/* 左端圓弧 */}
                      <circle cx="30" cy="100" r="4" fill="#ef4444" />

                      {/* 彩色區域 - 橙色 (20-50%) */}
                      <path
                        d="M 45 54 A 80 80 0 0 1 110 20"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="8"
                        strokeLinecap="butt"
                      />
                      {/* 彩色區域 - 綠色 (50-90%) */}
                      <path
                        d="M 110 20 A 80 80 0 0 1 185 74"
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="8"
                        strokeLinecap="butt"
                      />
                      {/* 彩色區域 - 紅色 (90-100%) */}
                      <path
                        d="M 185 74 A 80 80 0 0 1 190 100"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="8"
                        strokeLinecap="butt"
                      />
                      {/* 右端圓弧 */}
                      <circle cx="190" cy="100" r="4" fill="#ef4444" />

                      {/* 背景陰影 - 永久顯示 */}
                      {(() => {
                        const outerRadius = 84;
                        const innerRadius = 68;
                        const backgroundSegments = [];

                        // 紅色背景 0-20%
                        const red1StartAngle = 180;
                        const red1EndAngle = 180 - 20 * 1.8;
                        const red1StartRadianOuter = (red1StartAngle * Math.PI) / 180;
                        const red1EndRadianOuter = (red1EndAngle * Math.PI) / 180;
                        const red1StartRadianInner = (red1StartAngle * Math.PI) / 180;
                        const red1EndRadianInner = (red1EndAngle * Math.PI) / 180;

                        backgroundSegments.push(
                          <path
                            key="bg-red1"
                            d={`M ${110 + outerRadius * Math.cos(red1StartRadianOuter)} ${100 - outerRadius * Math.sin(red1StartRadianOuter)} A ${outerRadius} ${outerRadius} 0 0 1 ${110 + outerRadius * Math.cos(red1EndRadianOuter)} ${100 - outerRadius * Math.sin(red1EndRadianOuter)} L ${110 + innerRadius * Math.cos(red1EndRadianInner)} ${100 - innerRadius * Math.sin(red1EndRadianInner)} A ${innerRadius} ${innerRadius} 0 0 0 ${110 + innerRadius * Math.cos(red1StartRadianInner)} ${100 - innerRadius * Math.sin(red1StartRadianInner)} Z`}
                            fill="#ef4444"
                            opacity="0.15"
                          />
                        );

                        // 橙色背景 20-50%
                        const orangeStartAngle = 180 - 20 * 1.8;
                        const orangeEndAngle = 180 - 50 * 1.8;
                        const orangeStartRadianOuter = (orangeStartAngle * Math.PI) / 180;
                        const orangeEndRadianOuter = (orangeEndAngle * Math.PI) / 180;
                        const orangeStartRadianInner = (orangeStartAngle * Math.PI) / 180;
                        const orangeEndRadianInner = (orangeEndAngle * Math.PI) / 180;

                        backgroundSegments.push(
                          <path
                            key="bg-orange"
                            d={`M ${110 + outerRadius * Math.cos(orangeStartRadianOuter)} ${100 - outerRadius * Math.sin(orangeStartRadianOuter)} A ${outerRadius} ${outerRadius} 0 0 1 ${110 + outerRadius * Math.cos(orangeEndRadianOuter)} ${100 - outerRadius * Math.sin(orangeEndRadianOuter)} L ${110 + innerRadius * Math.cos(orangeEndRadianInner)} ${100 - innerRadius * Math.sin(orangeEndRadianInner)} A ${innerRadius} ${innerRadius} 0 0 0 ${110 + innerRadius * Math.cos(orangeStartRadianInner)} ${100 - innerRadius * Math.sin(orangeStartRadianInner)} Z`}
                            fill="#f59e0b"
                            opacity="0.15"
                          />
                        );

                        // 綠色背景 50-90%
                        const greenStartAngle = 180 - 50 * 1.8;
                        const greenEndAngle = 180 - 90 * 1.8;
                        const greenStartRadianOuter = (greenStartAngle * Math.PI) / 180;
                        const greenEndRadianOuter = (greenEndAngle * Math.PI) / 180;
                        const greenStartRadianInner = (greenStartAngle * Math.PI) / 180;
                        const greenEndRadianInner = (greenEndAngle * Math.PI) / 180;

                        backgroundSegments.push(
                          <path
                            key="bg-green"
                            d={`M ${110 + outerRadius * Math.cos(greenStartRadianOuter)} ${100 - outerRadius * Math.sin(greenStartRadianOuter)} A ${outerRadius} ${outerRadius} 0 0 1 ${110 + outerRadius * Math.cos(greenEndRadianOuter)} ${100 - outerRadius * Math.sin(greenEndRadianOuter)} L ${110 + innerRadius * Math.cos(greenEndRadianInner)} ${100 - innerRadius * Math.sin(greenEndRadianInner)} A ${innerRadius} ${innerRadius} 0 0 0 ${110 + innerRadius * Math.cos(greenStartRadianInner)} ${100 - innerRadius * Math.sin(greenStartRadianInner)} Z`}
                            fill="#22c55e"
                            opacity="0.15"
                          />
                        );

                        // 紅色背景 90-100%
                        const red2StartAngle = 180 - 90 * 1.8;
                        const red2EndAngle = 180 - 100 * 1.8;
                        const red2StartRadianOuter = (red2StartAngle * Math.PI) / 180;
                        const red2EndRadianOuter = (red2EndAngle * Math.PI) / 180;
                        const red2StartRadianInner = (red2StartAngle * Math.PI) / 180;
                        const red2EndRadianInner = (red2EndAngle * Math.PI) / 180;

                        backgroundSegments.push(
                          <path
                            key="bg-red2"
                            d={`M ${110 + outerRadius * Math.cos(red2StartRadianOuter)} ${100 - outerRadius * Math.sin(red2StartRadianOuter)} A ${outerRadius} ${outerRadius} 0 0 1 ${110 + outerRadius * Math.cos(red2EndRadianOuter)} ${100 - outerRadius * Math.sin(red2EndRadianOuter)} L ${110 + innerRadius * Math.cos(red2EndRadianInner)} ${100 - innerRadius * Math.sin(red2EndRadianInner)} A ${innerRadius} ${innerRadius} 0 0 0 ${110 + innerRadius * Math.cos(red2StartRadianInner)} ${100 - innerRadius * Math.sin(red2StartRadianInner)} Z`}
                            fill="#ef4444"
                            opacity="0.15"
                          />
                        );

                        return backgroundSegments;
                      })()}

                      {/* 當前數值填充弧形陰影 - 分段顯示 */}
                      {(() => {
                        const currentValue = essData.soc || 0;
                        const segments = [];
                        const outerRadius = 84;  // 外圈半徑
                        const innerRadius = 68;  // 內圈半徑

                        // 紅色區域 0-20%
                        if (currentValue > 0) {
                          const endValue = Math.min(currentValue, 20);
                          const startAngle = 180;
                          const endAngle = 180 - endValue * 1.8;
                          const startRadianOuter = (startAngle * Math.PI) / 180;
                          const endRadianOuter = (endAngle * Math.PI) / 180;
                          const startRadianInner = (startAngle * Math.PI) / 180;
                          const endRadianInner = (endAngle * Math.PI) / 180;

                          const outerStartX = 110 + outerRadius * Math.cos(startRadianOuter);
                          const outerStartY = 100 - outerRadius * Math.sin(startRadianOuter);
                          const outerEndX = 110 + outerRadius * Math.cos(endRadianOuter);
                          const outerEndY = 100 - outerRadius * Math.sin(endRadianOuter);

                          const innerStartX = 110 + innerRadius * Math.cos(startRadianInner);
                          const innerStartY = 100 - innerRadius * Math.sin(startRadianInner);
                          const innerEndX = 110 + innerRadius * Math.cos(endRadianInner);
                          const innerEndY = 100 - innerRadius * Math.sin(endRadianInner);

                          segments.push(
                            <path
                              key="red1"
                              d={`M ${outerStartX} ${outerStartY} A ${outerRadius} ${outerRadius} 0 0 1 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A ${innerRadius} ${innerRadius} 0 0 0 ${innerStartX} ${innerStartY} Z`}
                              fill="#ef4444"
                              opacity="0.6"
                            />
                          );
                        }

                        // 綠色區域 50-90%
                        if (currentValue > 50) {
                          const startValue = 50;
                          const endValue = Math.min(currentValue, 90);
                          const startAngle = 180 - startValue * 1.8;
                          const endAngle = 180 - endValue * 1.8;
                          const startRadianOuter = (startAngle * Math.PI) / 180;
                          const endRadianOuter = (endAngle * Math.PI) / 180;
                          const startRadianInner = (startAngle * Math.PI) / 180;
                          const endRadianInner = (endAngle * Math.PI) / 180;

                          const outerStartX = 110 + outerRadius * Math.cos(startRadianOuter);
                          const outerStartY = 100 - outerRadius * Math.sin(startRadianOuter);
                          const outerEndX = 110 + outerRadius * Math.cos(endRadianOuter);
                          const outerEndY = 100 - outerRadius * Math.sin(endRadianOuter);

                          const innerStartX = 110 + innerRadius * Math.cos(startRadianInner);
                          const innerStartY = 100 - innerRadius * Math.sin(startRadianInner);
                          const innerEndX = 110 + innerRadius * Math.cos(endRadianInner);
                          const innerEndY = 100 - innerRadius * Math.sin(endRadianInner);

                          segments.push(
                            <path
                              key="green"
                              d={`M ${outerStartX} ${outerStartY} A ${outerRadius} ${outerRadius} 0 0 1 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A ${innerRadius} ${innerRadius} 0 0 0 ${innerStartX} ${innerStartY} Z`}
                              fill="#22c55e"
                              opacity="0.6"
                            />
                          );
                        }

                        return segments;
                      })()}

                      {/* 刻度線 */}
                      {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((tick) => {
                        const angle = 180 - tick * 1.8;
                        const radian = (angle * Math.PI) / 180;
                        const x1 = 110 + 76 * Math.cos(radian);
                        const y1 = 100 - 76 * Math.sin(radian);
                        const x2 = 110 + (tick % 20 === 0 ? 66 : 70) * Math.cos(radian);
                        const y2 = 100 - (tick % 20 === 0 ? 66 : 70) * Math.sin(radian);
                        return (
                          <line
                            key={tick}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="#94a3b8"
                            strokeWidth={tick % 20 === 0 ? "2" : "1"}
                          />
                        );
                      })}

                      {/* 刻度數字 */}
                      {[0, 20, 40, 60, 80, 100].map((tick) => {
                        const angle = 180 - tick * 1.8;
                        const radian = (angle * Math.PI) / 180;
                        const x = 110 + 56 * Math.cos(radian);
                        const y = 100 - 56 * Math.sin(radian);
                        return (
                          <text
                            key={tick}
                            x={x}
                            y={y + 4}
                            textAnchor="middle"
                            fontSize="10"
                            fill="#64748b"
                            fontWeight="500"
                          >
                            {tick}
                          </text>
                        );
                      })}

                      {/* 指針 */}
                      <line
                        x1="110"
                        y1="100"
                        x2={110 + 65 * Math.cos((180 - (essData.soc || 0) * 1.8) * Math.PI / 180)}
                        y2={100 - 65 * Math.sin((180 - (essData.soc || 0) * 1.8) * Math.PI / 180)}
                        stroke="#1e293b"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <circle cx="110" cy="100" r="4" fill="#1e293b" />
                    </svg>
                  </div>

                  {/* 負載資訊 */}
                  <div className="text-center -mt-2">
                    <div className={`text-xl font-bold ${
                      (essData.soc || 0) < 20 ? 'text-red-600' :
                      (essData.soc || 0) < 50 ? 'text-orange-300' :
                      (essData.soc || 0) <= 90 ? 'text-green-600' :
                      'text-red-600'
                    }`}>{(essData.soc || 0).toFixed(0)}%</div>
                    <div className={`text-sm font-medium mt-1 ${
                      (essData.soc || 0) < 20 ? 'text-red-600' :
                      (essData.soc || 0) < 50 ? 'text-orange-300' :
                      (essData.soc || 0) <= 90 ? 'text-green-600' :
                      'text-red-600'
                    }`}>
                      {(essData.soc || 0) < 20 ? 'Risk' :
                       (essData.soc || 0) < 50 ? 'Low' :
                       (essData.soc || 0) <= 90 ? 'Normal' :
                       'Risk'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 系統狀態指標 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricCard
              title="系統狀態"
              value={essData.status}
              icon={Activity}
              status={essData.status === 'active' || (essData.switch || essData.ups?.switch) ? 'activate' : 'inactive'}
            />
            <MetricCard
              title="充放電狀態"
              value={essData.chargeStatus}
              icon={Activity}
              status={essData.chargeStatus ===0 ? "inactive":"active"}
            />
            <MetricCard
              title="充電電流"
              value={essData.current}
              unit="A"
              icon={Battery}
              status={essData.current ===0 ? "inactive":"active"}
            />
            <MetricCard
              title="充電電壓"
              value={essData.voltage}
              unit="V"
              icon={Zap}
              status={essData.voltage ===0 ? "inactive":"active"}
            />
            <MetricCard
              title="電池的健康狀態"
              value={essData.soh}
              unit="%"
              icon={Battery}
              status={essData.soh ==0 ? "inactive":"activate"}
            />
          </div>
        </div>

        {/* 右側 - PCS 頻率控制 */}
        <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border`}>
          <h3 className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>PCS 頻率控制</h3>

          {/* PCS 頻率儀表板 - 置中顯示 */}
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="relative w-52 h-32">
              <svg className="w-full h-full" viewBox="0 0 220 120">
                {/* 彩色區域 - 橙色 (59.77-59.90) */}
                <path
                  d="M 30 100 A 80 80 0 0 1 62 40"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="8"
                  strokeLinecap="butt"
                />
                {/* 左端圓弧 */}
                <circle cx="30" cy="100" r="4" fill="#f59e0b" />
                {/* 彩色區域 - 綠色 (59.90-60.00) */}
                <path
                  d="M 62 40 A 80 80 0 0 1 120 24"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="8"
                  strokeLinecap="butt"
                />
                {/* 彩色區域 - 紅色 (60.00-60.23) */}
                <path
                  d="M 120 24 A 80 80 0 0 1 190 100"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="8"
                  strokeLinecap="butt"
                />
                {/* 右端圓弧 */}
                <circle cx="190" cy="100" r="4" fill="#ef4444" />

                {/* 刻度線 */}
                {Array.from({ length: 47 }, (_, i) => 59.77 + i * 0.01).map((tick) => {
                  const percentage = ((tick - 59.77) / (60.23 - 59.77)) * 100;
                  const angle = 180 - percentage * 1.8;
                  const radian = (angle * Math.PI) / 180;
                  const x1 = 110 + 76 * Math.cos(radian);
                  const y1 = 100 - 76 * Math.sin(radian);
                  const isMainTick = Math.abs(tick - Math.round(tick * 20) / 20) < 0.001;
                  const x2 = 110 + (isMainTick ? 66 : 72) * Math.cos(radian);
                  const y2 = 100 - (isMainTick ? 66 : 72) * Math.sin(radian);
                  return (
                    <line
                      key={tick.toFixed(2)}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#94a3b8"
                      strokeWidth={isMainTick ? "2" : "0.5"}
                    />
                  );
                })}

                {/* 刻度數字 */}
                {[59.77, 59.85, 59.95, 60.05, 60.15, 60.23].map((tick) => {
                  const percentage = ((tick - 59.77) / (60.23 - 59.77)) * 100;
                  const angle = 180 - percentage * 1.8;
                  const radian = (angle * Math.PI) / 180;
                  const x = 110 + 56 * Math.cos(radian);
                  const y = 100 - 56 * Math.sin(radian);
                  return (
                    <text
                      key={tick}
                      x={x}
                      y={y + 4}
                      textAnchor="middle"
                      fontSize="8"
                      fill="#64748b"
                      fontWeight="500"
                    >
                      {tick.toFixed(2)}
                    </text>
                  );
                })}

                {/* 指針 */}
                <line
                  x1="110"
                  y1="100"
                  x2={110 + 65 * Math.cos((180 - ((essData.pcs.frequency - 59.77) / (60.23 - 59.77)) * 100 * 1.8) * Math.PI / 180)}
                  y2={100 - 65 * Math.sin((180 - ((essData.pcs.frequency - 59.77) / (60.23 - 59.77)) * 100 * 1.8) * Math.PI / 180)}
                  stroke="#1e293b"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="110" cy="100" r="4" fill="#1e293b" />
              </svg>
            </div>

            {/* 頻率資訊 */}
            <div className="text-center -mt-2">
              <div className={`text-3xl font-bold ${
                essData.pcs.frequency < 59.77 ? 'text-red-600' :
                essData.pcs.frequency < 59.90 ? 'text-orange-600' :
                essData.pcs.frequency <= 60.00 ? 'text-green-600' :
                'text-red-600'
              }`}>{essData.pcs.frequency.toFixed(2)} Hz</div>
              <div className={`text-xs font-medium mt-1 ${
                essData.pcs.frequency < 59.77 ? 'text-red-600' :
                essData.pcs.frequency < 59.90 ? 'text-orange-600' :
                essData.pcs.frequency <= 60.00 ? 'text-green-600' :
                'text-red-600'
              }`}>
                {essData.pcs.frequency < 59.77 ? 'Risk' :
                 essData.pcs.frequency < 59.90 ? 'Low' :
                 essData.pcs.frequency <= 60.00 ? 'Normal' :
                 'Risk'}
              </div>
            </div>
          </div>

          {/* Admin 權限提示 */}
          {isAdmin && (
            <div className={`${isDarkMode ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'} border rounded-lg p-3 mb-6`}>
              <div className="flex items-center space-x-2">
                <Settings className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <span className={`text-sm font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>管理員模式</span>
              </div>
              <p className={`text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-600'} mt-1`}>您可以點擊「手動調整」來修改頻率控制參數</p>
            </div>
          )}

          {/* 頻率控制區域 */}
          <div className={`${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-xl p-4 mb-4`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Activity className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <h4 className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>頻率控制</h4>
              </div>
              <button
                onClick={() => {
                  frequencyReset('pcs', 'frequency', 60.00);
                }}
                disabled={!isAdmin || isExecuting}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  !isAdmin || isExecuting
                    ? 'opacity-50 cursor-not-allowed bg-gray-300 text-gray-500'
                    : isDarkMode
                      ? 'bg-gray-600 hover:bg-gray-500 text-gray-200'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
                title="重設為 60Hz"
              >
                <RefreshCw className="w-3 h-3" />
                <span>重設 60Hz</span>
              </button>
            </div>

            {isAdmin ? (
              <div className="space-y-6">
                {/* 頻率圓形旋鈕 - 3D 立體設計 */}
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="relative w-56 h-56">
                    {/* 白色圓 - 3D浮凸感，加粗 */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white to-gray-100" style={{
                      boxShadow: 'inset 6px 6px 12px rgba(0, 0, 0, 0.15), inset -6px -6px 12px rgba(255, 255, 255, 1), 8px 8px 16px rgba(0, 0, 0, 0.15)'
                    }}></div>

                    {/* SVG 進度圓環 */}
                    <svg className="absolute inset-2 w-[calc(100%-1rem)] h-[calc(100%-1rem)] transform -rotate-90" viewBox="0 0 200 200">
                      {/* 背景圓環 - 淺灰色，浮凸效果 */}
                      <defs>
                        <filter id="ringEmboss">
                          <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
                          <feOffset dx="2" dy="2" result="offsetblur"/>
                          <feComponentTransfer>
                            <feFuncA type="linear" slope="0.3"/>
                          </feComponentTransfer>
                          <feMerge>
                            <feMergeNode/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                      </defs>
                      <circle
                        cx="100"
                        cy="100"
                        r="85"
                        fill="none"
                        stroke="#d1d5db"
                        strokeWidth="14"
                        filter="url(#ringEmboss)"
                      />

                      {/* 完整橘紅色圓環 - 不再是進度條 */}
                      <defs>
                        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#ff6b6b" />
                          <stop offset="100%" stopColor="#ff8e53" />
                        </linearGradient>
                      </defs>
                      <circle
                        cx="100"
                        cy="100"
                        r="85"
                        fill="none"
                        stroke="url(#progressGradient)"
                        strokeWidth="14"
                        className="drop-shadow-lg"
                        style={{ filter: 'drop-shadow(0 3px 6px rgba(255, 107, 107, 0.5))' }}
                      />

                      {/* 指標 - 小三角形指針 */}
                      {(() => {
                        const currentValue = editingValues['pcs_frequency'] !== undefined ? editingValues['pcs_frequency'] : essData.pcs.frequency;
                        const percentage = ((currentValue - 59.77) / (60.00 - 59.77)) * 100;
                        const angle = (percentage / 100) * 360;
                        const radian = (angle * Math.PI) / 180;

                        // 小三角形靠近橘色環
                        const distance = 75; // 靠近橘環但有小間距
                        const tipX = 100 + distance * Math.cos(radian);
                        const tipY = 100 + distance * Math.sin(radian);

                        // 三角形底部兩個點
                        const baseWidth = 5;
                        const triangleHeight = 8;
                        const baseX = 100 + (distance - triangleHeight) * Math.cos(radian);
                        const baseY = 100 + (distance - triangleHeight) * Math.sin(radian);

                        const perpAngle = radian + Math.PI / 2;
                        const base1X = baseX + baseWidth * Math.cos(perpAngle);
                        const base1Y = baseY + baseWidth * Math.sin(perpAngle);
                        const base2X = baseX - baseWidth * Math.cos(perpAngle);
                        const base2Y = baseY - baseWidth * Math.sin(perpAngle);

                        return (
                          <polygon
                            points={`${tipX},${tipY} ${base1X},${base1Y} ${base2X},${base2Y}`}
                            fill="#9ca3af"
                            className="transition-all duration-300"
                            style={{ filter: 'drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.3))' }}
                          />
                        );
                      })()}
                    </svg>

                    {/* 刻度線 SVG - 畫在白色環上 */}
                    <svg className="absolute inset-1 w-[calc(100%-0.5rem)] h-[calc(100%-0.5rem)] transform -rotate-90" viewBox="0 0 210 210">
                      {/* 刻度線 */}
                      {Array.from({ length: 36 }, (_, i) => {
                        const angle = (i / 35) * 360;
                        const radian = (angle * Math.PI) / 180;
                        const isMainTick = i % 9 === 0;
                        const x1 = 105 + 99 * Math.cos(radian);
                        const y1 = 105 + 99 * Math.sin(radian);
                        const x2 = 105 + (isMainTick ? 90 : 94) * Math.cos(radian);
                        const y2 = 105 + (isMainTick ? 90 : 94) * Math.sin(radian);

                        return (
                          <line
                            key={i}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="#cbd5e1"
                            strokeWidth={isMainTick ? "2" : "1.5"}
                            strokeLinecap="round"
                          />
                        );
                      })}
                    </svg>

                    {/* 中央數值顯示 */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center mt-6">
                      <div className={`text-3xl font-bold ${isDarkMode ? 'text-gray-800' : 'text-gray-900'} tracking-tight`}>
                        {(editingValues['pcs_frequency'] !== undefined ? editingValues['pcs_frequency'] : essData.pcs.frequency).toFixed(2)}
                      </div>
                      <div className="text-sm font-medium mt-1 text-gray-500">Hz</div>
                    </div>
                  </div>
                </div>

                {/* 三個控制按鈕 - 圓形立體設計 */}
                <div className="flex items-center justify-center gap-6">
                  {/* 減頻率 */}
                  <button
                    onClick={async () => {
                      const currentValue = editingValues['pcs_frequency'] !== undefined ? editingValues['pcs_frequency'] : essData.pcs.frequency;
                      const newValue = Math.max(59.77, currentValue - 0.01);
                      setEditingValues(prev => ({ ...prev, ['pcs_frequency']: newValue }));
                    }}
                    disabled={isExecuting || (editingValues['pcs_frequency'] !== undefined ? editingValues['pcs_frequency'] : essData.pcs.frequency) <= 59.77}
                    className={`relative w-16 h-16 rounded-full transition-all duration-200 ${
                      isExecuting || (editingValues['pcs_frequency'] !== undefined ? editingValues['pcs_frequency'] : essData.pcs.frequency) <= 59.77
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:scale-105 active:scale-95'
                    }`}
                    style={{
                      background: 'linear-gradient(145deg, #e3e8ef, #f5f7fa)',
                      boxShadow: '6px 6px 12px #c5cdd6, -6px -6px 12px #ffffff'
                    }}
                  >
                    <span className="text-2xl font-bold text-gray-700">−</span>
                  </button>

                  {/* 重整到60Hz */}
                  <button
                    onClick={() => frequencyReset('pcs', 'frequency', 60.00)}
                    disabled={isExecuting}
                    className={`relative w-16 h-16 rounded-full transition-all duration-200 ${
                      isExecuting
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:scale-105 active:scale-95'
                    }`}
                    style={{
                      background: 'linear-gradient(145deg, #e3e8ef, #f5f7fa)',
                      boxShadow: '6px 6px 12px #c5cdd6, -6px -6px 12px #ffffff'
                    }}
                  >
                    <RefreshCw className="w-6 h-6 text-gray-700 mx-auto" />
                  </button>

                  {/* 加頻率 */}
                  <button
                    onClick={async () => {
                      const currentValue = editingValues['pcs_frequency'] !== undefined ? editingValues['pcs_frequency'] : essData.pcs.frequency;
                      const newValue = Math.min(60.00, currentValue + 0.01);
                      setEditingValues(prev => ({ ...prev, ['pcs_frequency']: newValue }));
                    }}
                    disabled={isExecuting || (editingValues['pcs_frequency'] !== undefined ? editingValues['pcs_frequency'] : essData.pcs.frequency) >= 60.00}
                    className={`relative w-16 h-16 rounded-full transition-all duration-200 ${
                      isExecuting || (editingValues['pcs_frequency'] !== undefined ? editingValues['pcs_frequency'] : essData.pcs.frequency) >= 60.00
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:scale-105 active:scale-95'
                    }`}
                    style={{
                      background: 'linear-gradient(145deg, #e3e8ef, #f5f7fa)',
                      boxShadow: '6px 6px 12px #c5cdd6, -6px -6px 12px #ffffff'
                    }}
                  >
                    <span className="text-2xl font-bold text-gray-700">+</span>
                  </button>
                </div>

                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-center mt-4`}>
                  建議範圍: 59.77-60.00 Hz
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className={`text-4xl font-bold mb-2 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  {essData.pcs.frequency.toFixed(2)} Hz
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  (唯讀模式)
                </div>
              </div>
            )}
          </div>

          {/* 其他PCS指標 */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <MetricCard
              title="PCS狀態"
              value={essData.pcs.pcsStatus}
              icon={Activity}
              status={
                essData.pcs.pcsStatus === 'charging' ? 'charging' :
                essData.pcs.pcsStatus === 'standby' ? 'inactive' :
                'normal'
              }
            />
            <MetricCard
              title="電流"
              value={essData.pcs.current}
              unit="A"
              icon={Battery}
              status={
                essData.pcs.current === 0 ? 'inactive' :
                essData.pcs.current > 20 ? 'warning' :
                'normal'
              }
            />
            <MetricCard
              title="Grid狀態"
              value={essData.pcs.gridStatus}
              icon={Zap}
              status={
                essData.pcs.gridStatus === 'N/A' || essData.pcs.gridStatus === 0 ? 'inactive' :
                'normal'
              }
            />
          </div>
        </div>
      </div>

      {/* 標籤頁導航 */}
      <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl shadow-sm border overflow-hidden`}>
        <div className={`flex ${isDarkMode ? 'border-b border-gray-700' : 'border-b border-gray-200'}`}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? isDarkMode
                    ? 'bg-blue-900/50 text-blue-300 border-b-2 border-blue-500'
                    : 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : isDarkMode
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          <ActiveComponent />
        </div>
      </div>

      {/* 執行中提示 */}
      {isExecuting && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          <span>執行中...</span>
        </div>
      )}
    </div>
  );
};

export default ESSBattery;