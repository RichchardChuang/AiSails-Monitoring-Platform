import React, { useState } from 'react';
import { Fuel, Zap, Thermometer, Gauge, Activity, Power, Settings, AlertTriangle, CheckCircle, Battery } from 'lucide-react';

const DieselGen = ({ realTimeData, setRealTimeData, onCommandExecute }) => {
  const [activeTab, setActiveTab] = useState('status');
  const [isExecuting, setIsExecuting] = useState(false);
  
  const dieselData = realTimeData.diesel;

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
      
      // 如果父組件提供了 onCommandExecute callback，呼叫它
      if (onCommandExecute) {
        onCommandExecute({
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
      if (onCommandExecute) {
        onCommandExecute({
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

  const toggleDieselEngine = async () => {
    const newState = !dieselData.engineSwitch;
    const action = newState ? 'start_dg' : 'stop_dg';
    const description = newState ? '柴油發電機啟動' : '柴油發電機停止';
    
    // 立即更新 UI 狀態（樂觀更新）
    setRealTimeData(prev => ({
      ...prev,
      diesel: {
        ...prev.diesel,
        engineSwitch: newState,
        status: {
          ...prev.diesel.status,
          state: newState ? 1 : 0,
          frequency: newState ? 50 : 0
        }
      }
    }));
    
    // 在背景發送命令到後端
    const success = await sendCommand('diesel', action, description);
    
    // 如果失敗則還原狀態
    if (!success) {
      setRealTimeData(prev => ({
        ...prev,
        diesel: {
          ...prev.diesel,
          engineSwitch: !newState,
          status: {
            ...prev.diesel.status,
            state: !newState ? 1 : 0,
            frequency: !newState ? 50 : 0
          }
        }
      }));
    }
  };

  const MetricCard = ({ title, value, unit, status, icon: Icon, className = "", isSwitch = false, onToggle }) => (
    <div className={`bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 ${className}`}>
      {status && (
          <span className={`px-2 py-1 rounded-full text-[0.65rem] font-medium ${
            status === 'normal' || status === 'ready' || status === 'running' ? 'bg-green-100 text-green-800' :
            status === 'standby' ? 'bg-blue-100 text-blue-800' :
            status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
            status === 'pending' ? 'bg-yellow-100 text-yellow-800 animate-pulse' :
            'bg-gray-100 text-gray-800'
          }`}>
            {status === 'pending' ? 'STARTING...' : status.toUpperCase()}
          </span>
        )}
      <div className="flex items-start justify-between mb-4 mt-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-orange-50 rounded-lg">
            <Icon className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
          </div>
        </div>
      </div>
      
      <div className="flex items-end justify-between">
        <div>
          {isSwitch ? (
            <button
              onClick={onToggle}
              disabled={isExecuting}
              className={`flex items-center space-x-3 px-6 py-3 rounded-lg transition-colors font-medium text-lg ${
                value ? 'bg-green-500 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              } ${isExecuting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Power className="w-6 h-6" />
              <span>{value ? '引擎運行中' : '啟動發電機'}</span>
            </button>
          ) : (
            <div className="flex items-baseline space-x-1">
              <span className="text-2xl font-bold text-gray-900">
                {typeof value === 'number' ? value.toFixed(1) : value}
              </span>
              <span className="text-sm text-gray-500">{unit}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const StatusSystem = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="頻率"
          value={dieselData.status.frequency}
          unit="Hz"
          icon={Gauge}
          status="standby"
        />
        <MetricCard
          title="油壓"
          value={dieselData.status.oilPressure}
          unit="bar"
          icon={Fuel}
          status="normal"
        />
        <MetricCard
          title="冷卻溫度"
          value={dieselData.status.coolantTemp}
          unit="°C"
          icon={Thermometer}
          status="normal"
        />
        <MetricCard
          title="燃料"
          value={dieselData.status.fuel}
          unit=""
          icon={Fuel}
          status="ready"
        />
      </div>

      <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-6">發電機狀態監控</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 mb-3">運行狀態</h4>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">主機狀態</span>
              <span className={`font-medium ${dieselData.status.state === 0 ? 'text-blue-600' : 'text-green-600'}`}>
                {dieselData.status.state === 0 ? '待機' : '運行'}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">啟動模式</span>
              <span className="font-medium">自動</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">運行時間</span>
              <span className="font-medium">0 小時</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">上次啟動</span>
              <span className="font-medium">2025-07-15</span>
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 mb-3">機械參數</h4>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">引擎轉速</span>
              <span className="font-medium">0 RPM</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">機油壓力</span>
              <span className="font-medium">{dieselData.status.oilPressure} bar</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">冷卻水溫</span>
              <span className="font-medium">{dieselData.status.coolantTemp}°C</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">排氣溫度</span>
              <span className="font-medium">25°C</span>
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 mb-3">燃料系統</h4>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">主油箱</span>
              <span className="font-medium">85%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">日用油箱</span>
              <span className="font-medium">92%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">燃料消耗</span>
              <span className="font-medium">0 L/h</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">預計可運行</span>
              <span className="font-medium">48 小時</span>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-green-50 rounded-lg border-l-4 border-green-400">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800">柴油發電機組待機就緒</p>
              <p className="text-sm text-green-600">所有系統正常，可隨時啟動</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const PowerSystem = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Zap className="w-5 h-5 mr-2 text-orange-600" />
            L1 相
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">功率</span>
              <span className="font-bold text-xl">{dieselData.power.l1Power} kW</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">電壓</span>
              <span className="font-medium">{dieselData.power.l1Voltage} V</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">電流</span>
              <span className="font-medium">{dieselData.power.l1Current} A</span>
            </div>
          </div>
        </div>

        <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Zap className="w-5 h-5 mr-2 text-orange-600" />
            L2 相
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">功率</span>
              <span className="font-bold text-xl">{dieselData.power.l2Power} kW</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">電壓</span>
              <span className="font-medium">{dieselData.power.l2Voltage} V</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">電流</span>
              <span className="font-medium">{dieselData.power.l2Current} A</span>
            </div>
          </div>
        </div>

        <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Zap className="w-5 h-5 mr-2 text-orange-600" />
            L3 相
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">功率</span>
              <span className="font-bold text-xl">{dieselData.power.l3Power} kW</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">電壓</span>
              <span className="font-medium">{dieselData.power.l3Voltage} V</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">電流</span>
              <span className="font-medium">{dieselData.power.l3Current} A</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-6">總功率統計</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <span className="text-gray-700">總有效功率</span>
              <span className="font-bold text-xl text-orange-600">
                {(dieselData.power.l1Power + dieselData.power.l2Power + dieselData.power.l3Power)} kW
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">平均電壓</span>
              <span className="font-medium">
                {((dieselData.power.l1Voltage + dieselData.power.l2Voltage + dieselData.power.l3Voltage) / 3).toFixed(1)} V
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">平均電流</span>
              <span className="font-medium">
                {((dieselData.power.l1Current + dieselData.power.l2Current + dieselData.power.l3Current) / 3).toFixed(1)} A
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">功率因數</span>
              <span className="font-medium">0.85</span>
            </div>
          </div>
        </div>

        <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-6">負載平衡監控</h3>
          <div className="space-y-4">
            {['L1', 'L2', 'L3'].map((phase, index) => {
              const powers = [dieselData.power.l1Power, dieselData.power.l2Power, dieselData.power.l3Power];
              const maxPower = 100; // 假設最大功率為100kW
              const percentage = (powers[index] / maxPower) * 100;
              
              return (
                <div key={phase} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">{phase} 相負載</span>
                    <span className="text-sm text-gray-600">{powers[index]} kW ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                      style={{width: `${Math.max(5, percentage)}%`}}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-6 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800 font-medium">負載平衡狀況: 良好</p>
            <p className="text-xs text-blue-600">各相負載差異小於5%</p>
          </div>
        </div>
      </div>
    </div>
  );

  const OtherSystem = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="電池電壓"
          value={dieselData.other.batteryVoltage}
          unit="V"
          icon={Battery}
          status="normal"
        />
        <MetricCard
          title="磁場電壓"
          value={dieselData.other.fieldVoltage}
          unit="V"
          icon={Zap}
          status="normal"
        />
        <MetricCard
          title="溫度"
          value={dieselData.other.temperature}
          unit="°C"
          icon={Thermometer}
          status="normal"
        />
        <MetricCard
          title="功率"
          value={dieselData.other.power}
          unit=""
          icon={Power}
          status="standby"
        />
      </div>

      {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-6">電池系統</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">啟動電池電壓</span>
              <span className="font-medium">{dieselData.other.batteryVoltage} V</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">充電電流</span>
              <span className="font-medium">2.5 A</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">電池容量</span>
              <span className="font-medium">100 Ah</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">充電狀態</span>
              <span className="font-medium text-green-600">浮充</span>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="font-medium text-gray-900 mb-3">電池電壓趨勢</h4>
            <div className="h-24 bg-gray-50 rounded-lg p-3">
              <svg className="w-full h-full" viewBox="0 0 200 60">
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  points={Array.from({length: 15}, (_, i) => {
                    const x = (i * 200) / 14;
                    const y = 30 + (Math.random() - 0.5) * 20;
                    return `${x},${y}`;
                  }).join(' ')}
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-6">發電機參數</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">勵磁電壓</span>
              <span className="font-medium">{dieselData.other.fieldVoltage} V</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">勵磁電流</span>
              <span className="font-medium">0 A</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">絕緣電阻</span>
              <span className="font-medium">1000 MΩ</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">繞組溫度</span>
              <span className="font-medium">{dieselData.other.temperature}°C</span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <h4 className="font-medium text-gray-900">維護信息</h4>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">下次保養:</span>
                <span className="font-medium">2025-09-15</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">運行小時:</span>
                <span className="font-medium">245 小時</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">保養間隔:</span>
                <span className="font-medium">500 小時</span>
              </div>
            </div>
          </div>
        </div>
      </div> */}

      {/* <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-6">環境與安全監控</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">環境參數</h4>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">機房溫度:</span>
                <span className="font-medium">22°C</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">機房濕度:</span>
                <span className="font-medium">45%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">噪音等級:</span>
                <span className="font-medium">45 dB</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">安全狀態</h4>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">門鎖狀態:</span>
                <span className="font-medium text-green-600">已鎖定</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">煙霧偵測:</span>
                <span className="font-medium text-green-600">正常</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">緊急停止:</span>
                <span className="font-medium text-green-600">正常</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">通風系統</h4>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">排風扇:</span>
                <span className="font-medium text-blue-600">待機</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">進風百葉:</span>
                <span className="font-medium">關閉</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">溫控器:</span>
                <span className="font-medium text-green-600">正常</span>
              </div>
            </div>
          </div>
        </div>
      </div> */}
    </div>
  );

  const tabs = [
    { id: 'status', label: '狀態', component: StatusSystem },
    { id: 'power', label: '電力', component: PowerSystem },
    { id: 'other', label: '其他', component: OtherSystem }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || StatusSystem;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-orange-600 to-orange-800 rounded-xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">Diesel Generator</h2>
        <p className="text-orange-100">柴油發電機組監控與管理</p>
      </div>

      {/* 柴油發電機啟動控制 - 最外層顯眼位置 */}
      <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-6">發電機控制</h3>
        <div className="grid grid-cols-1 gap-6">
          <MetricCard
            title="柴油發電機"
            value={dieselData.engineSwitch || dieselData.status?.state === 1}
            icon={Power}
            status={(dieselData.engineSwitch || dieselData.status?.state === 1) ? 'running' : 'standby'}
            isSwitch={true}
            onToggle={toggleDieselEngine}
            className="border-2 shadow-lg"
          />
        </div>
        
        {/* 運行狀態提示 */}
        {(dieselData.engineSwitch || dieselData.status?.state === 1) ? (
          <div className="mt-4 p-4 bg-green-50 rounded-lg border-l-4 border-green-400">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">柴油發電機運行中</p>
                <p className="text-sm text-green-600">系統正常發電，請注意燃料消耗</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
            <div className="flex items-center space-x-3">
              <Activity className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-800">柴油發電機待機中</p>
                <p className="text-sm text-blue-600">系統就緒，可隨時啟動</p>
              </div>
            </div>
          </div>
        )}
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
                  ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-600'
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
    </div>
  );
};

export default DieselGen;