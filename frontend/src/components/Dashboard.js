import React, { useState, useEffect } from 'react';
import { Wind, Battery, Zap, Fuel, AlertTriangle, CheckCircle, Activity, TrendingUp, Cloud, Sun, CloudRain, Navigation } from 'lucide-react';

const Dashboard = ({ realTimeData, isDarkMode }) => {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const dieselData = realTimeData.diesel;

  useEffect(() => {
    updateWeatherInfo();
    const weatherInterval = setInterval(updateWeatherInfo, 60000); // 每1分鐘更新一次
    return () => {
      console.log('清除天氣更新間隔');
      clearInterval(weatherInterval);
    };
  }, []);

  const updateWeatherInfo = async () => {
    try {
      // 只在第一次載入時顯示 loading
      if (isFirstLoad) {
        setLoading(true);
      }
      // *****auto detect location*****
      // navigator.geolocation.getCurrentPosition(async (position) => {
      //         // const lat = position.coords.latitude;
      //         const lat = 24.0983;

      //         console.log('緯度:', lat);
      //         // const lon = position.coords.longitude;
      //         const lon = 120.3930;

      //         console.log('經度:', lon);
      //         // const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=4387509096865c786643f2bcd88e4160&lang=zh_tw&units=metric`);
      //         const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${24.0983}&lon=${120.3930}&appid=4387509096865c786643f2bcd88e4160&lang=zh_tw&units=metric`);

      // 直接使用固定經緯度，避免不同環境下的地理位置權限問題
      const lat = 24.0983;
      const lon = 120.3930;

      console.log('緯度:', lat);
      console.log('經度:', lon);

      const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=4387509096865c786643f2bcd88e4160&lang=zh_tw&units=metric`);

      const data = await response.json();

      // 風向中文轉換
      let windDir = '--';
      if (typeof data.wind?.deg === 'number') {
        const dirs = ['北', '北北東', '東北', '東北東', '東', '東南東', '東南', '南南東', '南', '南南西', '西南', '西南西', '西', '西北西', '西北', '北北西', '北'];
        windDir = dirs[Math.round(data.wind.deg / 22.5) % 16];
      }

      setWeatherData({
        location: data.name || '未知地點',
        description: data.weather?.[0]?.description || '未知天氣',
        temperature: data.main?.temp || 0,
        windSpeed: data.wind?.speed || 0,
        windDeg: data.wind?.deg || 0,
        windDir: windDir,
        icon: data.weather?.[0]?.icon || '01d',
        humidity: data.main?.humidity || 0,
        pressure: data.main?.pressure || 0
      });

      if (isFirstLoad) {
        setLoading(false);
        setIsFirstLoad(false);
      }
    } catch (error) {
      console.error('天氣載入失敗:', error);
      // 只在第一次載入時設置為 null，之後保留舊資料
      if (isFirstLoad) {
        setWeatherData(null);
        setLoading(false);
      }
    }
  };
  const MetricCard = ({ title, value, unit, change, trend, className = "", children,content = "", onClick }) => (
    <div
      className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border hover:shadow-md transition-all duration-300 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} font-medium`}>{title}</p>
          <div className="flex items-baseline mt-4">
            <span className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {typeof value === 'number' ? value.toFixed(1) : value}
            </span>
            <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} ml-1`}>{unit}</span>
          </div>
          {change && (
            <div className="flex items-center mt-2">
              <span className={`text-sm ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                {trend === 'up' ? '+' : '-'}{change}%
              </span>
            </div>
          )}
        </div>
        {children}
      </div>
      <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} font-medium`}>{content}</div>
    </div>
  );

  const CategorySpendingChart = () => {
    const categories = [
      { name: 'SkySails WindSpeed', value: (realTimeData.skysails?.windSpeed || 0), color: 'bg-blue-500', percentage: 40 },
      { name: 'ESS Battery', value: realTimeData.ess?.voltage || 0, color: 'bg-green-500', percentage: 35 },
      { name: 'PCS System', value: realTimeData.ess?.pcs?.activePower || 0, color: 'bg-purple-500', percentage: 20 },
      { name: 'Diesel Gen', value: 0, color: 'bg-orange-500', percentage: 5 }
    ];

    return (
      <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border`}>
        <h3 className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>System Distribution</h3>
        <div className="flex items-center justify-center mb-6">
          <div className="relative w-40 h-40">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="12" />
              <circle 
                cx="50" cy="50" r="40" fill="none" 
                stroke="#3b82f6" strokeWidth="12"
                strokeDasharray={`${categories[0].percentage * 2.51} 251`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
              <circle 
                cx="50" cy="50" r="40" fill="none" 
                stroke="#10b981" strokeWidth="12"
                strokeDasharray={`${categories[1].percentage * 2.51} 251`}
                strokeDashoffset={-categories[0].percentage * 2.51}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{categories[0].percentage}%</span>
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Active</span>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          {categories.map((category, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${category.color}`}></div>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{category.name}</span>
              </div>
              <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {(category.value || 0).toFixed(1)} {category.name === 'SkySails WindSpeed' ? 'm/s' : category.name === 'ESS Battery' ? 'V' : 'kW'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const RecentAlerts = () => {
    const alerts = [
      { 
        id: 1, 
        type: 'success', 
        message: 'SkySails PN14 operational', 
        amount: `${(realTimeData.skysails?.windSpeed || 0).toFixed(1)} m/s`, 
        // amount: "1m/s", 
        time: 'Now', 
        company: 'Wind System' 
      },
      { 
        id: 2, 
        type: (realTimeData.ess?.temperature || 0) > 5 ? 'warning' : 'success', 
        message: `ESS temperature ${(realTimeData.ess?.temperature || 0) > 5 ? 'rising' : 'normal'}`, 
        amount: `${(realTimeData.ess?.temperature || 0).toFixed(1)}°C`, 
        time: '2m ago', 
        company: 'ESS System' 
      },
      { 
        id: 3, 
        type: (realTimeData.ess?.pcs?.status || 'normal') === 'normal' ? 'success' : 'warning', 
        message: `PCS frequency control ${realTimeData.ess?.pcs?.status || 'unknown'}`, 
        amount: `${(realTimeData.ess?.pcs?.frequency || 0).toFixed(1)} Hz`, 
        time: '5m ago', 
        company: 'Power Control' 
      },
      { 
        id: 4, 
        type: 'info', 
        message: 'Diesel generator standby', 
        amount: 'Ready', 
        time: '10m ago', 
        company: 'Backup System' 
      },
      { 
        id: 5, 
        type: 'success', 
        message: 'System efficiency optimal', 
        amount: '94.2%', 
        time: '15m ago', 
        company: 'Performance' 
      }
    ];

    // const getIcon = (type) => {
    //   switch(type) {
    //     case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
    //     case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    //     case 'info': return <Activity className="w-4 h-4 text-blue-500" />;
    //     default: return <Activity className="w-4 h-4 text-gray-500" />;
    //   }
    // };

    // return (
    //   <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
    //     <div className="flex items-center justify-between mb-6">
    //       <h3 className="text-lg font-semibold">Recent Activity</h3>
    //       <select className="text-sm border border-gray-200 rounded-lg px-3 py-1">
    //         <option>Aug 2025</option>
    //         <option>Jul 2025</option>
    //         <option>Jun 2025</option>
    //       </select>
    //     </div>
    //     <div className="space-y-4 max-h-96 overflow-y-auto">
    //       {alerts.map((alert) => (
    //         <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
    //           <div className="flex items-center space-x-3">
    //             {getIcon(alert.type)}
    //             <div>
    //               <p className="text-sm font-medium text-gray-900">{alert.message}</p>
    //               <p className="text-xs text-gray-500">{alert.company}</p>
    //             </div>
    //           </div>
    //           <div className="text-right">
    //             <p className="text-sm font-semibold text-gray-900">{alert.amount}</p>
    //             <p className="text-xs text-gray-500">{alert.time}</p>
    //           </div>
    //         </div>
    //       ))}
    //     </div>
    //   </div>
    // );
  };

  const EnergyCard = () => (
    <div className={`relative rounded-2xl p-6 text-white overflow-hidden ${
      isDarkMode
        ? 'bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 border border-indigo-800'
        : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500'
    }`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>

      <div className="relative z-10">
        <div className="mb-8">
          <p className="text-sm opacity-80">Total System Power</p>
          <p className="text-4xl font-bold">
            {((realTimeData.skysails?.windSpeed || 0) * 100 + (realTimeData.ess?.pcs?.activePower || 0)).toFixed(0)} kW
          </p>
        </div>

        <div className="mb-6">
          <p className="text-sm opacity-80">Energy Management System</p>
          <p className="font-mono">Station •••• •••• 2025</p>
        </div>

        <div className="flex justify-end">
          <TrendingUp className="w-8 h-8" />
        </div>
      </div>
    </div>
  );

  const WeatherCard = () => {
    if (loading) {
      return (
        <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border`}>
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </div>
      );
    }

    if (!weatherData) {
      return (
        <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border`}>
          <div className="flex items-center justify-center h-40">
            <div className={`text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <Cloud className="w-8 h-8 mx-auto mb-2" />
              <p>無法取得天氣資訊</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`rounded-2xl p-6 text-white shadow-sm border relative overflow-hidden ${
        isDarkMode
          ? 'bg-gradient-to-br from-sky-900 via-blue-900 to-blue-950 border-blue-800'
          : 'bg-gradient-to-br from-sky-400 via-blue-500 to-blue-600 border-gray-100'
      }`}>
        {/* 背景裝飾 */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-12 translate-x-12"></div>
        <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-8 -translate-x-8"></div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Weather conditions</h3>
              <p className={`text-sm ${isDarkMode ? 'text-blue-200' : 'text-blue-100'}`}>{weatherData.location}</p>
            </div>
            <div className="flex items-center">
              <img 
                src={`https://openweathermap.org/img/wn/${weatherData.icon}@2x.png`}
                alt="天氣圖標" 
                className="w-12 h-12"
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-baseline">
              <span className="text-4xl font-bold">{weatherData.temperature.toFixed(1)}</span>
              <span className="text-lg ml-1">°C</span>
            </div>
            <p className={`text-sm capitalize ${isDarkMode ? 'text-blue-200' : 'text-blue-100'}`}>{weatherData.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <Wind className="w-4 h-4" />
              <div>
                <p className={isDarkMode ? 'text-blue-200' : 'text-blue-100'}>風速</p>
                <p className="font-semibold">{weatherData.windSpeed} m/s</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Navigation
                className="w-4 h-4"
                style={{ transform: `rotate(${weatherData.windDeg || 0}deg)` }}
              />
              <div>
                <p className={isDarkMode ? 'text-blue-200' : 'text-blue-100'}>風向</p>
                <p className="font-semibold">{weatherData.windDir}</p>
              </div>
            </div>
            <div>
              <p className={isDarkMode ? 'text-blue-200' : 'text-blue-100'}>濕度</p>
              <p className="font-semibold">{weatherData.humidity}%</p>
            </div>
            <div>
              <p className={isDarkMode ? 'text-blue-200' : 'text-blue-100'}>氣壓</p>
              <p className="font-semibold">{weatherData.pressure} hPa</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 系統連線狀態卡片
  const SystemStatusCard = () => {
    // 判斷各系統是否連線（根據資料是否存在且有效）
    const essOnline = realTimeData.ess?.voltage > 0;
    const pcsOnline = realTimeData.ess?.pcs?.frequency > 0;
    const dgOnline = realTimeData.diesel?.status?.started || false;
    const pn14Online = realTimeData.pn14?.connected || false;

    const totalSystems = 4;
    const onlineSystems = [essOnline, pcsOnline, dgOnline, pn14Online].filter(Boolean).length;

    const systems = [
      { name: 'ESS', online: essOnline, color: 'bg-green-500' },
      { name: 'PCS', online: pcsOnline, color: 'bg-blue-500' },
      { name: 'DG', online: dgOnline, color: 'bg-orange-500' },
      { name: 'PN14', online: pn14Online, color: 'bg-purple-500' }
    ];

    return (
      <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border hover:shadow-md transition-all duration-300`}>
        <div className="mb-4">
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} font-medium`}>系統連線</p>
          <div className="flex items-baseline mt-4">
            <span className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{onlineSystems}</span>
            <span className={`text-2xl ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} mx-1`}>/</span>
            <span className={`text-2xl ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{totalSystems}</span>
          </div>
          {/* <p className="text-xs text-gray-400 mt-1">部分離線</p> */}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {systems.map((system, index) => (
            <div
              key={index}
              className={`px-3 py-2 rounded-lg border-2 transition-all ${
                system.online
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'bg-red-50 border-red-500 text-red-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{system.name}</span>
                <div className={`w-2 h-2 rounded-full ${
                  system.online ? 'bg-green-500' : 'bg-red-500'
                } animate-pulse`}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* 頂部指標卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SystemStatusCard />

        {/* ESS Battery 狀態卡片 */}
        <MetricCard
          title="ESS"
          value={(realTimeData.ess?.ups?.soc || 0).toFixed(1)}
          unit="%"
          // change="1.8"
          trend="up"
          content={`Active: ${realTimeData.ess?.status || 'NaN'}`}
        >
          <Battery className="w-8 h-8 text-green-500" />
        </MetricCard>

        <MetricCard
          title="PCS Frequency"
          value={(realTimeData.ess.pcs.frequency || 0).toFixed(2)}
          unit="Hz"
          // change="1.8"
          trend="up"
          content={"Status: " + (realTimeData.ess.pcs.pcsStatus || 'NaN')}
        >
          <Zap className="w-8 h-8 text-purple-500" />
        </MetricCard>

        <MetricCard
          title="Diesel Status"
          value= {dieselData.status.engineSwitch === false ? '停止' : '運行'}
          unit=""
          // change="0"
          content={"frequency: " + (dieselData.other.power || "0") + " kw"}
          trend="up"
        >
          <Fuel className="w-8 h-8 text-orange-500" />
        </MetricCard>
      </div>

      {/* 主要圖表和信息區域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左側 - 系統分佈圖表 */}
        <div className="lg:col-span-1">
          <CategorySpendingChart />
        </div>

        {/* 中間 - 能源生產卡片和效能指標 */}
        <div className="lg:col-span-1 space-y-6">
          <EnergyCard />
          
          {/* 效能指標 */}
          {/* <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">System Performance</h3>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600 font-medium">+12%</span>
              </div>
            </div>
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
              <p className="text-sm opacity-90">Overall Efficiency</p>
              <p className="text-4xl font-bold">94.2%</p>
              <p className="text-xs opacity-80 mt-2">Above industry average</p>
            </div>
          </div> */}
        </div>

        {/* 右側 - 天氣狀況 */}
        <div className="lg:col-span-1">
          <WeatherCard />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;