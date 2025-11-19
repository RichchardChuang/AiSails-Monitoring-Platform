import React, { useState } from 'react';
import { Battery, Power, Thermometer, Zap, Activity, Settings, ToggleLeft, ToggleRight, AlertTriangle, CheckCircle, Gauge,RefreshCw } from 'lucide-react';

const ESSBattery = ({ realTimeData, setRealTimeData, handleCommandExecute }) => {
  const [activeTab, setActiveTab] = useState('pcs');
  const [isAdmin, setIsAdmin] = useState(true); // TODO: 從權限管理系統獲取
  const [isEditing, setIsEditing] = useState({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [originalValues, setOriginalValues] = useState({});

  const essData = realTimeData.ess;

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
  // 發送命令到後端
  await sendCommand(category, "pcs_freq_reset", `調整頻率重置為${InputValue}Hz`);
};

const toggleEditWithValue = async (key, currentInputValue) => {
  const [category, field] = key.split('_');
  
  // 先更新狀態
  handleValueChange(category, field, currentInputValue);
  
  // 頻率控制的特殊處理
  if (category === 'pcs' && field === 'frequency') {
    // 檢查數值範圍
    if (currentInputValue < 59.77) {
      alert('頻率值太低！請設定在 59.77-60 Hz 之間');
      const originalValue = originalValues[key];
      if (originalValue !== undefined) {
        handleValueChange(category, field, originalValue);
      }
      return;
    }
    if (currentInputValue > 60) {
      alert('頻率值太高！請設定在 59.77-60 Hz 之間');
      const originalValue = originalValues[key];
      if (originalValue !== undefined) {
        handleValueChange(category, field, originalValue);
      }
      return;
    }
    
    // 取得原始值進行比較
    const originalValue = originalValues[key];
    
    if (originalValue !== undefined) {
      let action;
      if (currentInputValue > originalValue) {
        action = 'pcs_freq_up';
      } else if (currentInputValue < originalValue) {
        action = 'pcs_freq_down';
      } else {
        // 值沒有改變，只切換編輯狀態
        setIsEditing(prev => ({
          ...prev,
          [key]: false
        }));
        return;
      }
      
      // 發送命令到後端
      await sendCommand(category, action, `調整頻率為${currentInputValue}Hz`);
    }
  }
  
  // 切換編輯狀態
  setIsEditing(prev => ({
    ...prev,
    [key]: false
  }));
};

const toggleEdit = async (key) => {
  const isCurrentlyEditing = isEditing[key];

  if (isCurrentlyEditing) {
    const [category, field] = key.split('_');
    const currentValue = essData[category][field];
      // 取得原始值
  const originalValue = originalValues[key] || essData[category][field];
    // 頻率控制的特殊處理
    if (category === 'pcs' && field === 'frequency') {
      // 檢查數值範圍
      // 方法2：將函數定義移到 if 判斷內部
      if (currentValue < 59.77) {
        alert('頻率值太低！請設定在 59.77-60 Hz 之間');
        const originalValue = originalValues[key] || essData[category][field];
        setRealTimeData(prev => ({
          ...prev,
          ess: {
            ...prev.ess,
            [category]: {
              ...prev.ess[category],
              [field]: originalValue
            }
          }
        }));
        return;
      }
      if (currentValue > 60) {
        alert('頻率值太高！請設定在 59.77-60 Hz 之間');
        const originalValue = originalValues[key] || essData[category][field];
        setRealTimeData(prev => ({
          ...prev,
          ess: {
            ...prev.ess,
            [category]: {
              ...prev.ess[category],
              [field]: originalValue
            }
          }
        }));
        return;
      }
      

      
      let action;
      if (currentValue > originalValue) {
        action = 'pcs_freq_up';
      } else if (currentValue < originalValue) {
        action = 'pcs_freq_down';
      } else {
        // 值沒有改變，不需要發送命令
        setIsEditing(prev => ({
          ...prev,
          [key]: !prev[key]
        }));
        return;
      }
      
      // 發送命令到後端
      await sendCommand(category, action, `調整頻率為${currentValue}Hz`);
    }
  } else {
    // 進入編輯模式時，保存原始值
    const [category, field] = key.split('_');
    setOriginalValues(prev => ({
      ...prev,
      [key]: essData[category][field]
    }));
  }
  
  // 切換編輯狀態
  setIsEditing(prev => ({
    ...prev,
    [key]: !prev[key]
  }));
};

  const MetricCard = ({ title, value, unit, status, icon: Icon, isSwitch = false, onToggle, className = "", editable = false, category = "", field = "" }) => (
    <div className={`bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 ${className}`}>
        {status && (
          <span className={`px-2 py-1 right-0 rounded-full text-[0.65rem] font-medium whitespace-nowrap flex-shrink-0 self-start ${
            status === 'activate' || status === 'normal' || status === 'Running' ? 'bg-green-100 text-green-800' :
            status === 'charging' ? 'bg-blue-100 text-blue-800' :
            status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
            status === 'offline' || status === 'OFFLINE' ? 'bg-red-100 text-red-800 font-semibold' :
            'bg-gray-200 text-gray-800'
          }`}>
            {status.toUpperCase()}
          </span>
        )}
      <div className="flex items-start justify-between mb-4 mt-3 gap-2">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
            <Icon className="w-5 h-5 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm xl:text-base font-semibold text-gray-900 whitespace-nowrap pr-2">{title}</h3>
            {editable && isAdmin && (
              <button
                onClick={() => {
                  if (isEditing[`${category}_${field}`]) {
                    const inputElement = document.querySelector(`input[data-category="${category}"][data-field="${field}"]`);
                    const currentInputValue = inputElement ? parseFloat(inputElement.value) : value;
                    toggleEditWithValue(`${category}_${field}`, currentInputValue);
                  } else {
                    toggleEdit(`${category}_${field}`);
                  }
                }}
                className="text-xs text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap"
              >
                {isEditing[`${category}_${field}`] ? '完成' : '手動調整'}
              </button>
            )}
            {editable && isAdmin && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    const InputValue = 60.00;
                    // 重設為 60.00
                    frequencyReset(category, field, InputValue);
                    // 如果正在編輯模式，也要更新 input 的值
                    if (isEditing[`${category}_${field}`]) {
                      const inputElement = document.querySelector(`input[data-category="${category}"][data-field="${field}"]`);
                      if (inputElement) {
                        inputElement.value = InputValue;
                      }
                    }
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  title="重設為 60Hz"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            )}
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
          ) : editable && isAdmin && isEditing[`${category}_${field}`] ? (
            <div className="flex items-center space-x-2">
              <input
                data-category={category}
                data-field={field}
                type="number"
                step="0.01"
                defaultValue={value}
                // onBlur={(e) => handleValueChange(category, field, e.target.value)}
                className="w-20 px-2 py-1 text-lg font-bold border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-sm text-gray-500">{unit}</span>
            </div>
          ) : (
            <div className="flex items-baseline space-x-1">
              <span className={`font-bold text-gray-900 ${category === 'pcs' && field === 'frequency' ? 'text-2xl xl:text-3xl' : 'text-2xl xl:text-3xl'}`}>
                {typeof value === 'number' ?(category === 'pcs' && field === 'frequency' ? value.toFixed(2) : value.toFixed(1)): value}
              </span>
              <span className="text-sm text-gray-500">{unit}</span>
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
      <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-6">UPS 系統監控</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">UPS狀態</span>
              <span className="font-medium text-green-600">{essData.status}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">輸入電壓</span>
              <span className="font-medium">{((essData.voltage || essData.ups?.voltage || 100) * 1.1).toFixed(1)} V</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">輸出電壓</span>
              <span className="font-medium">{(essData.voltage || essData.ups?.voltage || 100)} V</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">負載</span>
              <span className="font-medium">{essData.ups?.load || NaN}%</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">電池電壓</span>
              <span className="font-medium">{((essData.voltage || essData.ups?.voltage || 100) * 0.9).toFixed(1)} V</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">充電電流</span>
              <span className="font-medium">{(essData.current || essData.ups?.current || 10).toFixed(1)} A</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">運行時間</span>
              <span className="font-medium">245.2 小時</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">備用時間</span>
              <span className="font-medium">2.5 小時</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">內部溫度</span>
              <span className="font-medium">{(essData.temperature || essData.ups?.temperature || 3).toFixed(1)}°C</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">風扇狀態</span>
              <span className="font-medium text-blue-600">Auto</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">告警狀態</span>
              <span className="font-medium text-green-600">Normal</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">維護狀態</span>
              <span className="font-medium text-green-600">Good</span>
            </div>
          </div>
        </div>

        {/* UPS 負載趨勢 */}
        <div className="mt-6">
          <h4 className="font-medium text-gray-900 mb-4">UPS 負載趨勢</h4>
          <div className="h-32 bg-gray-50 rounded-lg p-4">
            <svg className="w-full h-full" viewBox="0 0 300 80">
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                points={Array.from({length: 20}, (_, i) => {
                  const x = (i * 300) / 19;
                  const y = 60 - ((essData.ups?.load || 90) / 100 * 50) + (Math.random() - 0.5) * 10;
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 xl:gap-3">
        <MetricCard
          title="運行狀態"
          value={essData.aircon.status}
          icon={Activity}
          status={essData.aircon.status === 'Running' ? 'activate' : 'offline'}
        />
        <MetricCard
          title="系統溫度"
          value={essData.aircon.temperature}
          unit="°C"
          icon={Thermometer}
          status="normal"
        />
        <MetricCard
          title="製冷設定"
          value={essData.aircon.temperature}
          unit="°C"
          icon={Thermometer}
          status="normal"
        />
        <MetricCard
          title="濕度"
          value={essData.aircon.humidity}
          unit="%"
          icon={Thermometer}
          status="normal"
        />
        <MetricCard
          title="模式"
          value={essData.aircon.mode}
          icon={Settings}
          status="normal"
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
      {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="頻率控制"
          value={essData.pcs.frequency}
          unit="Hz"
          icon={Activity}
          status={essData.pcs.status}
          editable={true}
          category="pcs"
          field="frequency"
        />
        <MetricCard
          title="電壓"
          value={essData.pcs.voltage}
          unit="V"
          icon={Zap}
          status={essData.pcs.status}
        />
        <MetricCard
          title="電流"
          value={essData.pcs.current}
          unit="A"
          icon={Battery}
          status={essData.pcs.status}
        />
        <MetricCard
          title="負載"
          value={essData.pcs.load}
          unit="%"
          icon={Gauge}
          status={essData.pcs.load > 90 ? 'warning' : 'normal'}
        />
      </div> */}

      {/* Admin 權限提示與頻率控制按鈕 */}
      {/* {isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <Settings className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">管理員模式</span>
              </div>
              <p className="text-xs text-blue-600 mt-1">您可以點擊「手動調整」來修改頻率控制參數</p>
            </div>
          </div>
        </div>
      )} */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-6">系統狀態</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">電壓</span>
              <span className="font-medium">{essData.pcs.voltage} V</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">供應頻率</span>
              <span className="font-medium">{essData.pcs.supplyFrequency} Hz</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">負載</span>
              <span className="font-medium">{essData.pcs.load}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">故障狀態</span>
              <span className={`font-medium ${essData.pcs.fault === '正常' ? 'text-green-600' : 'text-red-600'}`}>
                {essData.pcs.fault}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-6">功率控制</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">有效功率</span>
              <span className="font-medium text-blue-600">{essData.pcs.activePower} kW</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">無效功率</span>
              <span className="font-medium">{essData.pcs.reactivePower} kW</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">電壓</span>
              <span className="font-medium">{essData.pcs.voltage} V</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">負載</span>
              <span className="font-medium">{essData.pcs.load}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-6">詳細參數</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">電力參數</h4>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">DC電壓:</span>
                <span className="font-medium">{essData.pcs.dcVoltage} V</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">線電壓:</span>
                <span className="font-medium">{essData.pcs.lineVoltage} V</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">線頻率:</span>
                <span className="font-medium">{essData.pcs.lineFrequency} Hz</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">運行狀態</h4>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">運行模式:</span>
                <span className="font-medium">{essData.pcs.operatingMode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">PCS狀態:</span>
                <span className="font-medium">{essData.pcs.pcsStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">連線狀態:</span>
                <span className="font-medium">{essData.pcs.connectionStatus}</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">效能指標</h4>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">轉換效率:</span>
                <span className="font-medium">94.2%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">負載率:</span>
                <span className="font-medium">{essData.pcs.load}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">運行時間:</span>
                <span className="font-medium">156.3 小時</span>
              </div>
            </div>
          </div>
        </div>
      </div> */}
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
        <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-6">ESS Battery 系統控制</h3>

          {/* ESS 開關 with 負載儀表板 */}
          <div className="mb-6">
            <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300">
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
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Power className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-sm xl:text-base font-semibold text-gray-900">電網建立 (ESS)</h3>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={toggleESSSwitch}
                      disabled={!isAdmin || isExecuting}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                        (essData.switch || essData.ups?.switch) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                      } ${(!isAdmin || isExecuting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {(essData.switch || essData.ups?.switch) ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      <span className="font-medium text-xl">{(essData.switch || essData.ups?.switch) ? 'RUN' : 'STOP'}</span>
                    </button>
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
                        const currentValue = essData.ups?.load || 0;
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
                        x2={110 + 65 * Math.cos((180 - (essData.ups?.load || 0) * 1.8) * Math.PI / 180)}
                        y2={100 - 65 * Math.sin((180 - (essData.ups?.load || 0) * 1.8) * Math.PI / 180)}
                        stroke="#1e293b"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <circle cx="110" cy="100" r="4" fill="#1e293b" />
                    </svg>
                  </div>

                  {/* 負載資訊 */}
                  <div className="text-center -mt-2">
                    <div className="text-3xl font-bold text-gray-900">{(essData.ups?.load || 0).toFixed(0)}%</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {(essData.ups?.load || 0) < 20 ? '異常 0%-20%' :
                       (essData.ups?.load || 0) < 50 ? '目標 20%-50%' :
                       (essData.ups?.load || 0) <= 90 ? 'NORMAL' :
                       '異常 90%-100%'}
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
              status={essData.chargeStatus}
            />
            <MetricCard
              title="充電電流"
              value={essData.current}
              unit="A"
              icon={Battery}
              status="normal"
            />
            <MetricCard
              title="充電電壓"
              value={essData.voltage}
              unit="V"
              icon={Zap}
              status="normal"
            />
          </div>
        </div>

        {/* 右側 - PCS 頻率控制 */}
        <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-6">PCS 頻率控制</h3>

          {/* Admin 權限提示 */}
          {isAdmin && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <div className="flex items-center space-x-2">
                <Settings className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">管理員模式</span>
              </div>
              <p className="text-xs text-blue-600 mt-1">您可以點擊「手動調整」來修改頻率控制參數</p>
            </div>
          )}

          {/* PCS 控制指標 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricCard
              title="頻率控制"
              value={essData.pcs.frequency}
              unit="Hz"
              icon={Activity}
              status={essData.pcs.status}
              editable={true}
              category="pcs"
              field="frequency"
            />
            <MetricCard
              title="PCS狀態"
              value={essData.pcs.pcsStatus}
              icon={Activity}
              status={essData.pcs.pcsStatus === 'charging' ? 'charging' : 'normal'}
            />
            <MetricCard
              title="電流"
              value={essData.pcs.current}
              unit="A"
              icon={Battery}
              status={essData.pcs.status}
            />
            <MetricCard
              title="Grid狀態"
              value={essData.pcs.gridStatus}
              icon={Zap}
              status="normal"
            />
          </div>
        </div>
      </div>

      {/* 標籤頁導航 */}
      <div className="bg-white/70 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
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