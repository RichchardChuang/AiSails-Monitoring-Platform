import React, { useState } from 'react';
import { Wind, Activity, Gauge, TrendingUp, Power, AlertTriangle, CheckCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const SkySails = ({ realTimeData, setRealTimeData, isDarkMode }) => {
  const [chartTimeRange, setChartTimeRange] = useState('1h');

  const skysailsData = realTimeData.skysails;

  const MetricCard = ({ title, value, unit, status, icon: Icon, trend, subtitle, className = "" }) => (
    <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border hover:shadow-md transition-all duration-300 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 ${isDarkMode ? 'bg-blue-900/50' : 'bg-blue-50'} rounded-lg`}>
            <Icon className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <div>
            <h3 className={`font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{title}</h3>
            {subtitle && <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{subtitle}</p>}
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
            <span className={`text-4xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              {typeof value === 'number' ? value.toFixed(1) : value}
            </span>
            <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{unit}</span>
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
      const currentWindSpeed = Math.max(0, skysailsData.windSpeed + (Math.random() - 0.5) * 8);
      
      data.push({
        time: chartTimeRange === '1h' ? `${i}m ago` : 
              chartTimeRange === '24h' ? `${i}h ago` : 
              `${i}d ago`,
        windSpeed: currentWindSpeed,
        tension: Math.max(0, skysailsData.tension + (Math.random() - 0.5) * 500),
        // 功率根據風速計算，風速的立方關係更接近實際風力發電
        power: Math.max(0, Math.min(100, Math.pow(currentWindSpeed / 15, 3) * 80 + (Math.random() - 0.5) * 10))
      });
    }
    return data.reverse();
  };

  const chartData = generateChartData();

  const WindSpeedChart = () => (
    <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Wind Speed Trend</h3>
        <div className="flex space-x-2">
          {['1h', '24h', '7d'].map((range) => (
            <button
              key={range}
              onClick={() => setChartTimeRange(range)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                chartTimeRange === range
                  ? isDarkMode
                    ? 'bg-blue-900/50 text-blue-300'
                    : 'bg-blue-100 text-blue-700'
                  : isDarkMode
                    ? 'text-gray-400 hover:bg-gray-700'
                    : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      
      <div className="h-64 relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#f3f4f6'} />
            <XAxis
              dataKey="time"
              axisLine={true}
              tickLine={false}
              tick={{ fontSize: 10, fill: isDarkMode ? '#9ca3af' : '#6b7280' }}
            />
            {/* 左側 Y 軸 - 風速 */}
            <YAxis
              yAxisId="left"
              domain={[0, 25]}
              axisLine={true}
              tickLine={false}
              tick={{ fontSize: 10, fill: isDarkMode ? '#9ca3af' : '#6b7280' }}
              label={{ value: '風速 (m/s)', angle: -90, position: 'insideLeft', fill: isDarkMode ? '#9ca3af' : '#6b7280' }}
            />
            {/* 右側 Y 軸 - 功率 */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              axisLine={true}
              tickLine={false}
              tick={{ fontSize: 10, fill: isDarkMode ? '#9ca3af' : '#6b7280' }}
              label={{ value: '功率 (kW)', angle: 90, position: 'insideRight', fill: isDarkMode ? '#9ca3af' : '#6b7280' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDarkMode ? '#1f2937' : 'white',
                border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                borderRadius: '8px',
                fontSize: '12px',
                color: isDarkMode ? '#e5e7eb' : '#000000'
              }}
            />
            {/* 風速線 - 使用左側 Y 軸 */}
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="windSpeed" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ fill: '#3b82f6', strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, stroke: '#3b82f6', strokeWidth: 2 }}
              name="風速"
            />
            {/* 功率線 - 使用右側 Y 軸 */}
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="power" 
              stroke="#ef4444" 
              strokeWidth={2}
              dot={{ fill: '#ef4444', strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, stroke: '#ef4444', strokeWidth: 2 }}
              name="功率"
            />
          </LineChart>
        </ResponsiveContainer>
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