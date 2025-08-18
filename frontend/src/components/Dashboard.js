import React from 'react';
import { Wind, Battery, Zap, Fuel, AlertTriangle, CheckCircle, Activity, TrendingUp } from 'lucide-react';

const Dashboard = ({ realTimeData }) => {
  const MetricCard = ({ title, value, unit, change, trend, className = "", children, onClick }) => (
    <div 
      className={`bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <div className="flex items-baseline mt-2">
            <span className="text-2xl font-bold text-gray-900">
              {typeof value === 'number' ? value.toFixed(1) : value}
            </span>
            <span className="text-sm text-gray-500 ml-1">{unit}</span>
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
    </div>
  );

  const CategorySpendingChart = () => {
    const categories = [
      { name: 'SkySails', value: (realTimeData.skysails?.windSpeed || 0) * 100, color: 'bg-blue-500', percentage: 40 },
      { name: 'ESS Battery', value: realTimeData.ess?.voltage || 0, color: 'bg-green-500', percentage: 35 },
      { name: 'PCS System', value: realTimeData.ess?.pcs?.activePower || 0, color: 'bg-purple-500', percentage: 20 },
      { name: 'Diesel Gen', value: 0, color: 'bg-orange-500', percentage: 5 }
    ];

    return (
      <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-6">System Distribution</h3>
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
              <span className="text-2xl font-bold text-gray-900">{categories[0].percentage}%</span>
              <span className="text-sm text-gray-500">Active</span>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          {categories.map((category, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${category.color}`}></div>
                <span className="text-sm font-medium text-gray-700">{category.name}</span>
              </div>
              <span className="text-sm font-bold text-gray-900">
                {(category.value || 0).toFixed(1)} {category.name === 'SkySails' ? 'kW' : category.name === 'ESS Battery' ? 'V' : 'kW'}
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
    <div className="relative bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-6 text-white overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
      
      <div className="relative z-10">
        <div className="mb-8">
          <p className="text-sm opacity-80">Total System Power</p>
          <p className="text-3xl font-bold">
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

  return (
    <div className="space-y-8">
      {/* 頂部指標卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="SkySails Power"
          value={(realTimeData.skysails?.windSpeed || 0) * 100}
          unit="kW"
          change="5.2"
          trend="up"
        >
          <Wind className="w-8 h-8 text-green-600" />
        </MetricCard>

        <MetricCard
          title="ESS Voltage"
          value={realTimeData.ess?.voltage || 0}
          unit="V"
          change="2.1"
          trend="up"
        >
          <Battery className="w-8 h-8 text-green-500" />
        </MetricCard>

        <MetricCard
          title="PCS Power"
          value={realTimeData.ess?.pcs?.activePower || 0}
          unit="kW"
          change="1.8"
          trend="up"
        >
          <Zap className="w-8 h-8 text-purple-500" />
        </MetricCard>

        <MetricCard
          title="Diesel Status"
          value="Standby"
          unit=""
          change="0"
          trend="up"
        >
          <Fuel className="w-8 h-8 text-orange-500" />
        </MetricCard>
      </div>

      {/* 主要圖表和信息區域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 左側 - 系統分佈圖表 */}
        <div className="lg:col-span-1">
          <CategorySpendingChart />
        </div>

        {/* 中間 - 能源生產卡片 */}
        <div className="lg:col-span-1 space-y-6">
          <EnergyCard />
          
          {/* 效能指標 */}
          <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">System Performance</h3>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600 font-medium">+12%</span>
              </div>
            </div>
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
              <p className="text-sm opacity-90">Overall Efficiency</p>
              <p className="text-2xl font-bold">94.2%</p>
              <p className="text-xs opacity-80 mt-2">Above industry average</p>
            </div>
          </div>
        </div>

        {/* 右側 - 最近活動 */}
        <div className="lg:col-span-1">
          <RecentAlerts />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;