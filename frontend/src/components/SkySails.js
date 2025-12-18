import { useState, useEffect, useMemo, useRef, memo } from 'react';
import { Wind, Activity, Gauge, TrendingUp, Power, Zap, CloudRain, TrendingDown, Battery, Thermometer } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';

const SkySails = ({ realTimeData, setRealTimeData, isDarkMode }) => {
  const [activeView, setActiveView] = useState('overview');
  const [chartUpdateKey, setChartUpdateKey] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // 使用 ref 來儲存最新的 realTimeData，但不觸發重渲染
  const dataRef = useRef(realTimeData);

  // 靜默更新 ref (不會觸發重渲染)
  useEffect(() => {
    dataRef.current = realTimeData;
  }, [realTimeData]);

  // 初始載入後設定為 false
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 1500); // 1.5 秒後關閉初始動畫
    return () => clearTimeout(timer);
  }, []);

  // 從 ref 中取得資料
  const skysailsData = dataRef.current.skysails;
  const pn14Details = dataRef.current.pn14?.details || {};
  const groups = pn14Details.groups || {};

  // 側邊欄選項
  const views = [
    { id: 'overview', name: '總覽', shortName: 'Overview', icon: Activity },
    { id: 'power', name: '電力分析', shortName: 'Power', icon: Zap },
    { id: 'weather', name: '氣象資料', shortName: 'Weather', icon: CloudRain },
    { id: 'performance', name: '性能指標', shortName: 'Perf.', icon: TrendingUp },
    { id: 'system', name: '系統狀態', shortName: 'System', icon: Gauge }
  ];

  // 每 30 秒更新一次圖表資料 (獨立於外部 realTimeData 的更新)
  useEffect(() => {
    const interval = setInterval(() => {
      setChartUpdateKey(prev => prev + 1);
    }, 30000); // 30 秒
    return () => clearInterval(interval);
  }, []);

  // 生成趨勢資料
  // 使用 useMemo 緩存圖表數據，只在 chartUpdateKey 改變時才重新生成
  // 這樣即使 realTimeData 每秒更新，圖表也不會每秒重新渲染
  const trendData = useMemo(() => {
    const data = [];
    for (let i = 23; i >= 0; i--) {
      data.push({
        time: `${i}h`,
        windSpeed: Math.max(0, skysailsData.windSpeed + (Math.random() - 0.5) * 3),
        power: Math.max(0, (skysailsData.windSpeed + (Math.random() - 0.5) * 2) * 10),
        temperature: Math.max(15, Math.min(30, 22 + (Math.random() - 0.5) * 5)),
        humidity: Math.max(40, Math.min(80, 60 + (Math.random() - 0.5) * 20))
      });
    }
    return data.reverse();
  }, [chartUpdateKey]); // 只依賴 chartUpdateKey，不依賴 realTimeData

  // 電力分佈資料
  const powerDistribution = useMemo(() => {
    const gridcon = groups.Gridcon || {};
    return [
      { name: '有功功率', value: Math.abs(gridcon.ActivePower || 1.5), color: '#3b82f6' },
      { name: '無功功率', value: Math.abs(gridcon.ReactivePower || 1.3), color: '#60a5fa' },
      { name: '系統損耗', value: 0.5, color: '#93c5fd' }
    ];
  }, [chartUpdateKey]); // 只依賴 chartUpdateKey

  // 系統健康度資料
  const systemHealthData = useMemo(() => {
    const weather = groups.WeatherStation || {};
    return [
      { subject: '風速', value: Math.min(100, (skysailsData.windSpeed / 15) * 100), fullMark: 100 },
      { subject: '溫度', value: Math.min(100, ((weather.temperature || 20) / 35) * 100), fullMark: 100 },
      { subject: '濕度', value: Math.min(100, (weather.relativehumidity || 60)), fullMark: 100 },
      { subject: '壓力', value: Math.min(100, ((weather.pressure || 1000) / 1100) * 100), fullMark: 100 },
      { subject: '效能', value: 85, fullMark: 100 }
    ];
  }, [chartUpdateKey]); // 只依賴 chartUpdateKey

  // 小型數據卡片
  const SmallCard = ({ title, value, unit, icon: Icon, trend, color = 'blue' }) => (
    <div className={`${isDarkMode ? 'bg-gray-800/80' : 'bg-white/80'} backdrop-blur-sm rounded-xl p-2 md:p-4 shadow-sm border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} hover:shadow-md transition-all`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{title}</span>
        <Icon className={`w-4 h-4 text-${color}-500`} />
      </div>
      <div className="flex items-baseline space-x-1">
        <span className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          {typeof value === 'number' ? value.toFixed(1) : value}
        </span>
        <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{unit}</span>
      </div>
      {trend && (
        <div className="flex items-center mt-1">
          {trend > 0 ? (
            <TrendingUp className="w-3 h-3 text-green-500 mr-1" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-500 mr-1" />
          )}
          <span className={`text-xs ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {Math.abs(trend)}%
          </span>
        </div>
      )}
    </div>
  );

  // 總覽視圖
  const OverviewView = () => {
    const gridcon = groups.Gridcon || {};
    const weather = groups.WeatherStation || {};

    return (
      <div className="space-y-3 md:space-y-6">
        {/* 快速指標 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
          <SmallCard title="即時風速" value={skysailsData.windSpeed} unit="m/s" icon={Wind} trend={5.2} color="blue" />
          <SmallCard title="有功功率" value={Math.abs(gridcon.ActivePower || 0)} unit="kW" icon={Zap} trend={-2.1} color="yellow" />
          <SmallCard title="環境溫度" value={weather.temperature || 0} unit="°C" icon={Thermometer} trend={1.5} color="orange" />
          <SmallCard title="相對濕度" value={weather.relativehumidity || 0} unit="%" icon={CloudRain} trend={0} color="cyan" />
        </div>

        {/* 主要圖表區 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
          {/* 趨勢圖 */}
          <div className={`${isDarkMode ? 'bg-gray-800/80' : 'bg-white/80'} backdrop-blur-sm rounded-xl p-3 md:p-6 shadow-sm border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <h3 className={`text-sm md:text-lg font-semibold mb-2 md:mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>24小時風速趨勢</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorWind" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="time" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} style={{ fontSize: '10px' }} />
                <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} style={{ fontSize: '10px' }} width={40} />
                <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1f2937' : 'white', border: 'none', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="windSpeed" stroke="#3b82f6" fillOpacity={1} fill="url(#colorWind)" isAnimationActive={isInitialLoad} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 系統健康雷達圖 */}
          <div className={`${isDarkMode ? 'bg-gray-800/80' : 'bg-white/80'} backdrop-blur-sm rounded-xl p-3 md:p-6 shadow-sm border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <h3 className={`text-sm md:text-lg font-semibold mb-2 md:mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>系統健康度</h3>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={systemHealthData}>
                <PolarGrid stroke={isDarkMode ? '#4b5563' : '#d1d5db'} strokeWidth={1.5} />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 13, fontWeight: 500 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1f2937' : 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 12px'
                  }}
                  labelStyle={{ color: isDarkMode ? '#fff' : '#000', fontWeight: 'bold' }}
                  formatter={(value) => [`${value.toFixed(1)}%`, '健康度']}
                />
                <Radar name="健康度" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="#3b82f6" fillOpacity={0.6} isAnimationActive={isInitialLoad} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 電力分佈圓餅圖 */}
        <div className={`${isDarkMode ? 'bg-gray-800/80' : 'bg-white/80'} backdrop-blur-sm rounded-xl p-3 md:p-6 shadow-sm border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-sm md:text-lg font-semibold mb-2 md:mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>電力分佈</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={powerDistribution}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, percent, x, y, fill, cx }) => {
                  const isRightSide = x > cx;
                  return (
                    <text
                      x={x}
                      y={y}
                      fill={fill}
                      textAnchor={isRightSide ? 'start' : 'end'}
                      dominantBaseline="central"
                      fontSize="12"
                      fontWeight="500"
                    >
                      <tspan x={x} dy="-21">{name}</tspan>
                      <tspan x={x} dy="17">{(percent * 100).toFixed(0)}%</tspan>
                    </text>
                  );
                }}
                outerRadius={75}
                fill="#8884d8"
                dataKey="value"
                isAnimationActive={isInitialLoad}
              >
                {powerDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // 電力分析視圖
  const PowerView = () => {
    const gridcon = groups.Gridcon || {};
    const powerHistory = useMemo(() => {
      return trendData.map((item) => ({
        time: item.time,
        active: Math.abs(gridcon.ActivePower || 0) + (Math.random() - 0.5) * 0.5,
        reactive: Math.abs(gridcon.ReactivePower || 0) + (Math.random() - 0.5) * 0.3,
        total: Math.abs(gridcon.ActivePower || 0) + Math.abs(gridcon.ReactivePower || 0) + (Math.random() - 0.5) * 0.8
      }));
    }, [trendData]); // 只依賴 trendData，不依賴 gridcon

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SmallCard title="有功功率" value={Math.abs(gridcon.ActivePower || 0)} unit="kW" icon={Zap} color="blue" />
          <SmallCard title="無功功率" value={Math.abs(gridcon.ReactivePower || 0)} unit="kVar" icon={Power} color="cyan" />
          <SmallCard title="電池電量" value={gridcon.BatterySOC || 0} unit="%" icon={Battery} color="green" />
        </div>

        {/* 功率趨勢長條圖 */}
        <div className={`${isDarkMode ? 'bg-gray-800/80' : 'bg-white/80'} backdrop-blur-sm rounded-xl p-6 shadow-sm border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>功率歷史記錄</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={powerHistory} margin={{ top: 5, right: -5, left: -25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
              <XAxis dataKey="time" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} style={{ fontSize: '10px' }} />
              <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} style={{ fontSize: '10px' }} width={30} />
              <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1f2937' : 'white', border: 'none', borderRadius: '8px' }} />
              <Legend />
              <Bar dataKey="active" fill="#3b82f6" name="有功功率" radius={[8, 8, 0, 0]} isAnimationActive={isInitialLoad} />
              <Bar dataKey="reactive" fill="#06b6d4" name="無功功率" radius={[8, 8, 0, 0]} isAnimationActive={isInitialLoad} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 電力詳細數據 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(gridcon).map(([key, value]) => (
            <div key={key} className={`${isDarkMode ? 'bg-gray-800/80' : 'bg-white/80'} backdrop-blur-sm rounded-lg p-4 border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{key}</span>
              <div className={`text-xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {typeof value === 'number' ? value.toFixed(2) : value || 'N/A'}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 氣象資料視圖
  const WeatherView = () => {
    const weather = groups.WeatherStation || {};

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SmallCard title="溫度" value={weather.temperature || 0} unit="°C" icon={Thermometer} color="orange" />
          <SmallCard title="濕度" value={weather.relativehumidity || 0} unit="%" icon={CloudRain} color="cyan" />
          <SmallCard title="氣壓" value={weather.pressure || 0} unit="hPa" icon={Gauge} color="blue" />
          <SmallCard title="風速" value={weather.apparentwindSpeed || 0} unit="m/s" icon={Wind} color="sky" />
        </div>

        {/* 溫濕度趨勢 */}
        <div className={`${isDarkMode ? 'bg-gray-800/80' : 'bg-white/80'} backdrop-blur-sm rounded-xl p-6 shadow-sm border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>溫濕度變化</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData} margin={{ top: 5, right: -5, left: -25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
              <XAxis dataKey="time" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} style={{ fontSize: '10px' }} />
              <YAxis yAxisId="left" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} style={{ fontSize: '10px' }} width={30} />
              <YAxis yAxisId="right" orientation="right" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} style={{ fontSize: '10px' }} width={30} />
              <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1f2937' : 'white', border: 'none', borderRadius: '8px' }} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="temperature" stroke="#f97316" strokeWidth={2} name="溫度 (°C)" isAnimationActive={isInitialLoad} />
              <Line yAxisId="right" type="monotone" dataKey="humidity" stroke="#06b6d4" strokeWidth={2} name="濕度 (%)" isAnimationActive={isInitialLoad} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 氣象詳細數據 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(weather).map(([key, value]) => (
            <div key={key} className={`${isDarkMode ? 'bg-gray-800/80' : 'bg-white/80'} backdrop-blur-sm rounded-lg p-4 border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{key}</span>
              <div className={`text-xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {typeof value === 'number' ? value.toFixed(2) : value || 'N/A'}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 性能指標視圖
  const PerformanceView = () => (
    <div className="space-y-6">
      <div className={`${isDarkMode ? 'bg-gray-800/80' : 'bg-white/80'} backdrop-blur-sm rounded-xl p-6 shadow-sm border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>系統性能趨勢</h3>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={trendData} margin={{ top: 5, right: -5, left: -25, bottom: 5 }}>
            <defs>
              <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
            <XAxis dataKey="time" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} style={{ fontSize: '10px' }} />
            <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} style={{ fontSize: '10px' }} width={30} />
            <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1f2937' : 'white', border: 'none', borderRadius: '8px' }} />
            <Area type="monotone" dataKey="power" stroke="#3b82f6" fill="url(#colorPower)" isAnimationActive={isInitialLoad} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // 系統狀態視圖
  const SystemView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        {Object.keys(groups).map((groupKey) => {
          const groupData = groups[groupKey];
          if (!groupData || Object.keys(groupData).length === 0) return null;

          return (
            <div key={groupKey} className={`${isDarkMode ? 'bg-gray-800/80' : 'bg-white/80'} backdrop-blur-sm rounded-xl p-6 shadow-sm border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{groupKey}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(groupData).map(([key, value]) => (
                  <div key={key} className={`${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg p-3`}>
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{key}</span>
                    <div className={`text-lg font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {typeof value === 'number' ? value.toFixed(2) : value || 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // 渲染當前視圖
  const renderView = () => {
    switch (activeView) {
      case 'overview': return <OverviewView />;
      case 'power': return <PowerView />;
      case 'weather': return <WeatherView />;
      case 'performance': return <PerformanceView />;
      case 'system': return <SystemView />;
      default: return <OverviewView />;
    }
  };

  return (
    <div className="flex space-x-2 md:space-x-4">
      {/* 透明側邊欄 */}
      <div className={`w-16 md:w-24 flex-shrink-0 ${isDarkMode ? 'bg-gray-900/50' : 'bg-white/50'} backdrop-blur-md rounded-xl md:rounded-2xl p-2 md:p-3 shadow-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} relative z-40 md:z-50`}>
        <div className="space-y-2 md:space-y-3">
          {views.map((view) => {
            const Icon = view.icon;
            const isActive = activeView === view.id;
            return (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id)}
                className={`w-full p-2 md:p-3 rounded-lg md:rounded-xl transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-blue-500 text-white shadow-lg'
                    : isDarkMode
                      ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5 md:w-6 md:h-6 mx-auto" />
                <span className="text-[8px] md:text-[10px] mt-0.5 md:mt-1 block text-center font-medium whitespace-pre-line leading-tight">
                  {view.shortName}
                </span>

                {/* 浮動提示 */}
                <div className={`absolute left-full ml-2 px-3 py-2 rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-900 text-white'} shadow-lg z-[9999]`}>
                  {view.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 主要內容區 */}
      <div className="flex-1 space-y-3 md:space-y-6">
        {/* 頁面標題 */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 rounded-xl p-3 md:p- text-white shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg md:text-3xl font-bold mb-1 md:mb-2 flex items-center">
                <Wind className="w-5 h-5 md:w-8 md:h-8 mr-2 md:mr-3 animate-pulse flex-shrink-0" />
                <span className="truncate">SkySails PN14</span>
              </h2>
              <p className="text-blue-100 text-xs md:text-sm">風力發電系統即時監控與資料分析</p>
            </div>
            <div className={`px-1.5 py-0.5 md:px-2 md:py-1 rounded-md ${pn14Details.connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse flex-shrink-0 ml-2`}>
              <span className="text-[10px] md:text-xs font-medium whitespace-nowrap">{pn14Details.connected ? '✓ 已連接' : '✗ 離線'}</span>
            </div>
          </div>
        </div>

        {/* 動態內容 */}
        {renderView()}
      </div>
    </div>
  );
};

// 使用 React.memo 包裹組件，自定義比較函數
// 只在 isDarkMode 改變時才重新渲染，忽略 realTimeData 的變化
export default memo(SkySails, (prevProps, nextProps) => {
  // 返回 true 表示不重新渲染，返回 false 表示需要重新渲染
  // 只有當 isDarkMode 改變時才重新渲染
  return prevProps.isDarkMode === nextProps.isDarkMode;
});
