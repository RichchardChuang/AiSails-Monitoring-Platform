import React, { useState } from 'react';
import { Wind, Activity, Gauge, TrendingUp, Power, AlertTriangle, CheckCircle } from 'lucide-react';

const SkySails = ({ realTimeData, setRealTimeData }) => {
  const [chartTimeRange, setChartTimeRange] = useState('1h');
  
  const skysailsData = realTimeData.skysails;

  const MetricCard = ({ title, value, unit, status, icon: Icon, trend, subtitle, className = "" }) => (
    <div className={`bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Icon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
        </div>
        {status && (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            status === 'active' ? 'bg-green-100 text-green-800' :
            status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {status.toUpperCase()}
          </span>
        )}
      </div>
      
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-baseline space-x-1">
            <span className="text-2xl font-bold text-gray-900">
              {typeof value === 'number' ? value.toFixed(1) : value}
            </span>
            <span className="text-sm text-gray-500">{unit}</span>
          </div>
          {trend && (
            <div className="flex items-center mt-1">
              <TrendingUp className="w-3 h-3 text-green-500 mr-1" />
              <span className="text-xs text-green-600">+{trend}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // 模擬風速歷史數據
  const generateChartData = () => {
    const points = chartTimeRange === '1h' ? 60 : chartTimeRange === '24h' ? 24 : 7;
    const data = [];
    for (let i = points; i >= 0; i--) {
      data.push({
        time: chartTimeRange === '1h' ? `${i}m ago` : 
              chartTimeRange === '24h' ? `${i}h ago` : 
              `${i}d ago`,
        windSpeed: Math.max(0, skysailsData.windSpeed + (Math.random() - 0.5) * 8),
        tension: Math.max(0, skysailsData.tension + (Math.random() - 0.5) * 500),
        power: Math.max(0, (skysailsData.windSpeed + (Math.random() - 0.5) * 8) * 100)
      });
    }
    return data.reverse();
  };

  const chartData = generateChartData();

  const WindSpeedChart = () => (
    <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Wind Speed Trend</h3>
        <div className="flex space-x-2">
          {['1h', '24h', '7d'].map((range) => (
            <button
              key={range}
              onClick={() => setChartTimeRange(range)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                chartTimeRange === range 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      
      <div className="h-64 relative">
        <svg className="w-full h-full" viewBox="0 0 400 200">
          {/* Grid lines */}
          {Array.from({length: 5}, (_, i) => (
            <line
              key={i}
              x1="40"
              y1={40 + i * 32}
              x2="380"
              y2={40 + i * 32}
              stroke="#f3f4f6"
              strokeWidth="1"
            />
          ))}
          
          {/* Chart line */}
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            points={chartData.map((point, index) => 
              `${40 + (index * 340 / (chartData.length - 1))},${180 - (point.windSpeed * 8)}`
            ).join(' ')}
          />
          
          {/* Data points */}
          {chartData.map((point, index) => (
            <circle
              key={index}
              cx={40 + (index * 340 / (chartData.length - 1))}
              cy={180 - (point.windSpeed * 8)}
              r="3"
              fill="#3b82f6"
            />
          ))}
          
          {/* Y-axis labels */}
          {Array.from({length: 5}, (_, i) => (
            <text
              key={i}
              x="35"
              y={185 - i * 32}
              fill="#6b7280"
              fontSize="10"
              textAnchor="end"
            >
              {i * 5}
            </text>
          ))}
        </svg>
        
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-10 text-xs text-gray-500">
          <span>{chartData[0]?.time}</span>
          <span>Now</span>
        </div>
      </div>
    </div>
  );

  const TensionGauge = () => {
    const maxTension = 5000;
    const percentage = (skysailsData.tension / maxTension) * 100;
    const strokeDasharray = 2 * Math.PI * 70; // 圓周長
    const strokeDashoffset = strokeDasharray - (strokeDasharray * percentage) / 100;

    return (
      <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-6">Tension Monitor</h3>
        <div className="flex items-center justify-center">
          <div className="relative w-40 h-40">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="#f3f4f6"
                strokeWidth="10"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke={percentage > 80 ? "#ef4444" : percentage > 60 ? "#f59e0b" : "#10b981"}
                strokeWidth="10"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-2xl font-bold text-gray-900">{skysailsData.tension}</span>
              <span className="text-sm text-gray-500">N</span>
              <span className="text-xs text-gray-400">{percentage.toFixed(1)}%</span>
            </div>
          </div>
        </div>
        <div className="mt-4 text-center">
          <div className="flex justify-between text-sm text-gray-500">
            <span>0 N</span>
            <span>Max: {maxTension} N</span>
          </div>
        </div>
      </div>
    );
  };

  const PowerOutput = () => {
    const power = skysailsData.windSpeed * 100; // 模擬功率計算
    
    return (
      <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-6">Power Output</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-700">Current Output</span>
            <span className="font-bold text-lg text-blue-600">{power.toFixed(1)} kW</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-700">Efficiency</span>
            <span className="font-medium">
              {Math.min(95, 70 + (skysailsData.windSpeed / 20 * 25)).toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-700">Daily Total</span>
            <span className="font-medium">{(power * 24).toFixed(0)} kWh</span>
          </div>
        </div>
        
        {/* 功率趨勢小圖 */}
        <div className="mt-6">
          <p className="text-sm text-gray-500 mb-2">24h Power Trend</p>
          <div className="h-16 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-2">
            <svg className="w-full h-full" viewBox="0 0 200 40">
              <polyline
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                points={Array.from({length: 24}, (_, i) => {
                  const x = (i * 200) / 23;
                  const y = 35 - (Math.random() * 25 + 5);
                  return `${x},${y}`;
                }).join(' ')}
              />
            </svg>
          </div>
        </div>
      </div>
    );
  };

  const SystemStatus = () => (
    <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold mb-6">System Status</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border-l-4 border-green-400">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800">SkySails PN14 Operational</p>
              <p className="text-sm text-green-600">All systems functioning normally</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Uptime</p>
            <p className="text-lg font-bold text-gray-900">99.2%</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Last Maintenance</p>
            <p className="text-lg font-bold text-gray-900">7d ago</p>
          </div>
        </div>
        
        {skysailsData.windSpeed > 15 && (
          <div className="flex items-center space-x-3 p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">High Wind Speed Warning</p>
              <p className="text-sm text-yellow-600">Wind speed exceeds normal operating range</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">SkySails PN14 監控</h2>
        <p className="text-blue-100">風力發電系統實時監控與狀態顯示</p>
      </div>

      {/* 主要指標卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="風速"
          value={skysailsData.windSpeed}
          unit="m/s"
          status={skysailsData.status}
          icon={Wind}
          trend={skysailsData.windSpeed > 10 ? "5.2" : null}
          subtitle="平均風速"
        />
        <MetricCard
          title="拉力"
          value={skysailsData.tension}
          unit="N"
          status={skysailsData.tension > 3000 ? "warning" : "active"}
          icon={Gauge}
          trend={skysailsData.tension > 2000 ? "3.1" : null}
          subtitle="系統張力"
        />
        <MetricCard
          title="狀態"
          value={skysailsData.status === 'active' ? '運行中' : '待機'}
          unit=""
          status={skysailsData.status}
          icon={Activity}
          subtitle="系統狀態"
        />
      </div>

      {/* 圖表和監控區域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <WindSpeedChart />
        </div>
      </div>

      {/* <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TensionGauge />
        <PowerOutput />
        <SystemStatus />
      </div> */}

      {/* 詳細數據表 */}
      {/* <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-6">詳細參數</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 mb-3">風力參數</h4>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">瞬時風速</span>
              <span className="font-medium">{skysailsData.windSpeed.toFixed(1)} m/s</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">平均風速 (10min)</span>
              <span className="font-medium">{(skysailsData.windSpeed * 0.9).toFixed(1)} m/s</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">最大風速 (今日)</span>
              <span className="font-medium">{(skysailsData.windSpeed * 1.3).toFixed(1)} m/s</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">風向</span>
              <span className="font-medium">西南風</span>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 mb-3">張力系統</h4>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">主纜張力</span>
              <span className="font-medium">{skysailsData.tension} N</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">最大張力</span>
              <span className="font-medium">{(skysailsData.tension * 1.2).toFixed(0)} N</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">張力變化率</span>
              <span className="font-medium">+2.3%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">安全係數</span>
              <span className="font-medium">2.1</span>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 mb-3">發電參數</h4>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">瞬時功率</span>
              <span className="font-medium">{(skysailsData.windSpeed * 100).toFixed(1)} kW</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">今日發電量</span>
              <span className="font-medium">{(skysailsData.windSpeed * 100 * 8).toFixed(0)} kWh</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">發電效率</span>
              <span className="font-medium">{Math.min(95, 70 + (skysailsData.windSpeed / 20 * 25)).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">運行時間</span>
              <span className="font-medium">18.5 小時</span>
            </div>
          </div>
        </div>
      </div> */}
    </div>
  );
};

export default SkySails;