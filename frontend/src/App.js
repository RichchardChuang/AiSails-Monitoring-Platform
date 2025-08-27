import React, { useState, useEffect } from 'react';
import { Wind, Battery, Zap, Fuel,RotateCw , AlertTriangle, CheckCircle, Activity, TrendingUp, Settings, BarChart3, Gauge, Menu, X, User, Search, Bell, FileText } from 'lucide-react';

// 導入各個頁面組件
import Dashboard from './components/Dashboard';
import Reports from './components/Reports';
import SkySails from './components/SkySails';
import ESSBattery from './components/ESSBattery';
import DieselGen from './components/DieselGen';
import SettingsPage from './components/SettingsPage';

// API 基礎 URL - 方案 A (前後端分離)
const API_BASE_URL = 'http://localhost:5000/api';

const App = () => {
  const [selectedCategory, setSelectedCategory] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentSite, setCurrentSite] = useState('Site 彰濱');
  const [realTimeData, setRealTimeData] = useState({
    skysails: {
      windSpeed: 0,
      tension: 0,
      status: 'standby'
    },
    ess: {
      switch: false,
      status: 'inactive',
      voltage: 0,
      current: 0,
      rack1: {
        temperature:0
      },
      rack2: {
        temperature:0
      },
      rack3: {
        temperature:0
      },
      rack4: {
        temperature:0
      },
      ups: {
        load: 0,
        status: 'normal'
      },
      aircon: {
        status: 'Running',
        temperature: 3,
        humidity: 50,
        mode: 'Cooling'
      },
      pcs: {
        frequency: 0,
        voltage: 0,
        current: 0,
        status: 'normal',
        activePower: 0,
        reactivePower: 0,
        load: 0,
        connectionStatus: 'Off',
        operatingMode: '微電網',
        pcsStatus: 'standby',
        gridStatus: 'Grid Disconnected',
        supplyFrequency: 0,
        dcVoltage: 0,
        fault: '正常',
        lineVoltage: 0,
        lineFrequency: 0
      }
    },
    diesel: {
      engineSwitch: false,
      status: {
        state: 0,
        frequency: 0,
        oilPressure: 0,
        coolantTemp: 0,
        fuel: 0
      },
      power: {
        l1Power: 0,
        l2Power: 0,
        l3Power: 0,
        l1Voltage: 0,
        l2Voltage: 0,
        l3Voltage: 0,
        l1Current: 0,
        l2Current: 0,
        l3Current: 0
      },
      other: {
        batteryVoltage: 0,
        fieldVoltage: 0,
        temperature: 0,
        power: 0
      }
    }
  });

  // API 請求函數
  const apiRequest = async (endpoint, options = {}) => {
    try {
      setError(null);
      const response = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      setError(err.message);
      console.error('API request failed:', err);
      throw err;
    }
  };
  
  // 獲取所有系統數據 (新的統一數據獲取)
  const fetchAllSystemData = async () => {
    setIsLoading(true);
    try {
      await fetchDeviceStatus();
    } catch (err) {
      console.error('Failed to fetch system data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDeviceStatus = async () => {
    try {
      setError(null);
      const response = await fetch('/status');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // 將後端數據映射到前端 realTimeData 結構
      if (data.devices) {
        setRealTimeData(prev => ({
          skysails: {
            windSpeed: data.devices.pn14?.wind || 0,
            tension: data.devices.pn14?.force || 0,
            status: data.devices.pn14?.status === 'Inactive' ? 'standby' : 'active'
          },
          ess: {
            // ESS Battery 外層控制
            switch: data.devices.sbms?.active || false,
            status: data.devices.sbms?.active ? 'active' : 'inactive',
            voltage: data.devices.sbms?.voltage || 0,
            current: data.devices.sbms?.current || 0,
            rack1: {
              temperature: data.devices.sbms?.rack1?.temperature || 0
            },
            rack2: {
              temperature: data.devices.sbms?.rack2?.temperature || 0
            },
            rack3: {
              temperature: data.devices.sbms?.rack3?.temperature || 0
            },
            rack4: {
              temperature: data.devices.sbms?.rack4?.temperature || 0
            },
            // temperature: data.devices.sbms?.temperature || 0,

            // UPS 系統
            ups: {
              load: Math.round((data.devices.sbms?.soc || 0)), // 使用 SOC 作為負載
              status: data.devices.sbms?.connected ? 'normal' : 'offline'
            },

            // 空調系統 (暫時使用假數據，因為後端沒有相關數據)
            aircon: {
              status: 'Running',
              temperature: 3,
              humidity: 50,
              mode: 'Cooling'
            },

            // PCS 頻率控制
            pcs: {
              frequency: data.devices.pcs?.frequency || 0,
              voltage: data.devices.pcs?.linevoltage || 0,
              current: data.devices.pcs?.current || 0,
              status: data.devices.pcs?.connected ? 'normal' : 'offline',
              activePower: data.devices.pcs?.power || 0,
              reactivePower: 0, // 後端沒有此數據
              load: Math.round((data.devices.pcs?.power || 0) / 100 * 100), // 簡單計算負載百分比
              connectionStatus: data.devices.pcs?.connected ? 'On' : 'Off',
              operatingMode: data.devices.pcs?.operationmode ? '微電網' : '主網',
              pcsStatus: data.devices.pcs?.pcsstatus === 1 ? 'charging' : 'standby',
              gridStatus: data.devices.pcs?.gridstatus === 1 ? 'Grid Connected' : 'Grid Disconnected',
              supplyFrequency: data.devices.pcs?.supplyfrequency || 0,
              dcVoltage: data.devices.pcs?.dcvoltage || 0,
              fault: data.devices.pcs?.fault === 0 ? '正常' : '故障',
              lineVoltage: data.devices.pcs?.linevoltage || 0,
              lineFrequency: data.devices.pcs?.linefrequency || 0
            }
          },
          diesel: {
            engineSwitch: data.devices.diesel?.status?.includes('Started') || false,
            status: {
              Mode: data.devices.diesel?.status?.includes('Auto') ? 0 : 1,
              ACB: data.devices.diesel?.status?.includes('OFF') ? 0 : 1,
              frequency: data.devices.diesel?.frequency || 0,
              oilPressure: data.devices.diesel?.oilpressure || 0,
              coolantTemp: data.devices.diesel?.coolertemperature || 0,
              fuel: data.devices.diesel?.fuel || 0
            },
            power: {
              l1Power: data.devices.diesel?.l1power || 0,
              l2Power: data.devices.diesel?.l2power || 0,
              l3Power: data.devices.diesel?.l3power || 0,
              l1Voltage: data.devices.diesel?.l1l2voltage || 0,
              l2Voltage: data.devices.diesel?.l2l3voltage || 0,
              l3Voltage: data.devices.diesel?.l3l1voltage || 0,
              l1Current: data.devices.diesel?.l1current || 0,
              l2Current: data.devices.diesel?.l2current || 0,
              l3Current: data.devices.diesel?.l3current || 0
            },
            other: {
              batteryVoltage: data.devices.diesel?.batteryvoltage || 0,
              fieldVoltage: data.devices.diesel?.chargemagneticvoltage || 0,
              temperature: data.devices.diesel?.temperature || 0,
              power: data.devices.diesel?.power || 0
            }
          }
        }));
      }
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch device status:', err);
      throw err;
    }
  };

  // 模擬實時數據更新
  useEffect(() => {
    fetchAllSystemData().catch(() => {
      console.log('API not available, using simulated data');
    });

    const interval = setInterval(() => {
      fetchAllSystemData().catch(() => {
        // 模擬數據更新
        setRealTimeData(prev => ({
          ...prev,
          skysails: {
            ...prev.skysails,
            windSpeed: Math.max(0, prev.skysails.windSpeed + (Math.random() - 0.5) * 2),
            tension: Math.max(0, prev.skysails.tension + (Math.random() - 0.5) * 100)
          },
          ess: {
            ...prev.ess,
            ups: {
              ...prev.ess.ups,
              voltage: Math.max(90, Math.min(110, prev.ess.ups.voltage + (Math.random() - 0.5) * 2)),
              current: Math.max(8, Math.min(12, prev.ess.ups.current + (Math.random() - 0.5) * 0.5)),
              temperature: Math.max(0, Math.min(10, prev.ess.ups.temperature + (Math.random() - 0.5) * 0.5))
            },
            pcs: {
              ...prev.ess.pcs,
              frequency: Math.max(18, Math.min(22, prev.ess.pcs.frequency + (Math.random() - 0.5) * 0.5)),
              voltage: Math.max(95, Math.min(105, prev.ess.pcs.voltage + (Math.random() - 0.5) * 1)),
              current: Math.max(18, Math.min(22, prev.ess.pcs.current + (Math.random() - 0.5) * 0.5))
            }
          }
        }));
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'skysails', label: 'SkySails PN14', icon: Wind },
    { id: 'ess', label: 'ESS Battery', icon: Battery },
    { id: 'diesel', label: 'Diesel Gen', icon: Fuel },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  // 錯誤顯示組件
  const ErrorMessage = () => {
    if (!error) return null;

    return (
      <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg z-50">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm font-medium">Internet Error: {error}</span>
        </div>
      </div>
    );
  };

   // 載入中顯示
  const LoadingOverlay = () => {
    if (!isLoading) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 shadow-xl flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          <span className="text-gray-700">Loading...</span>
        </div>
      </div>
    );
  };

  const handleCommandExecute = (commandData) => {
    // 這裡可以更新 Reports 的 logs
    console.log('Diesel command executed:', commandData);
  };

  // 渲染主要內容
  const renderContent = () => {
    const props = {
      realTimeData,
      setRealTimeData,
      apiRequest,
      isLoading,
      setIsLoading,
      currentSite,
      setCurrentSite,
      handleCommandExecute
    };

    switch (selectedCategory) {
      case 'dashboard':
        return <Dashboard {...props} />;
      case 'reports':
        return <Reports {...props} />;
      case 'skysails':
        return <SkySails {...props} />;
      case 'ess':
        return <ESSBattery {...props} />;
      case 'diesel':
        return <DieselGen 
          realTimeData={realTimeData}
          setRealTimeData={setRealTimeData}
          onCommandExecute={handleCommandExecute}
        />;
      case 'settings':
        return <SettingsPage {...props} />;
      default:
        return <Dashboard {...props} />;
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <ErrorMessage />
      <LoadingOverlay />

      <div className="flex h-screen">
        {/* 側邊欄 - 固定高度，獨立滾動 */}
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-slate-950 to-indigo-700 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col`}>
          {/* 頂部標題區域 - 固定不滾動 */}
          <div className="flex items-center justify-between p-6 border-b border-indigo-700 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div>
                <h1 className="text-lg font-bold text-white mb-3">
                  <img src="\images\aisails-logo.png" className="w-25 h-8" alt="AiSails Logo" />
                </h1>
                <p className="text-xs text-indigo-200">{currentSite}</p>
              </div>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 導航菜單區域 - 可滾動，自定義美化滾動條 */}
          <nav className="flex-1 p-4" style={{
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255, 255, 255, 0.3) transparent'
          }}>
            <style>
              {`
                nav::-webkit-scrollbar {
                  width: 6px;
                }
                nav::-webkit-scrollbar-track {
                  background: transparent;
                }
                nav::-webkit-scrollbar-thumb {
                  background: rgba(255, 255, 255, 0.3);
                  border-radius: 3px;
                  transition: all 0.3s ease;
                }
                nav::-webkit-scrollbar-thumb:hover {
                  background: rgba(255, 255, 255, 0.5);
                }
              `}
            </style>
            <ul className="space-y-2">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        setSelectedCategory(item.id);
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${selectedCategory === item.id
                          ? 'bg-white bg-opacity-20 text-white shadow-lg'
                          : 'text-indigo-200 hover:bg-white hover:bg-opacity-10 hover:text-white'
                        }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* 主要內容區域 - 左邊留出側邊欄空間，移除多重滾動 */}
        <div className="flex-1 lg:ml-0 flex flex-col h-screen">
          {/* 頂部導航 - 固定不滾動 */}
          <header className="bg-blue-/70 shadow-sm border-b border-gray-200 px-4 lg:px-8 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="lg:hidden text-gray-600 hover:text-gray-900"
                >
                  <Menu className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold text-gray-900 capitalize">
                  {selectedCategory === 'skysails' ? 'SkySails PN14' :
                    selectedCategory === 'ess' ? 'ESS Battery' :
                      selectedCategory === 'diesel' ? 'Diesel Generator' :
                        selectedCategory}
                </h2>
                {error && (
                  <span className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
                    API Offline
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={fetchAllSystemData}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Refresh data"
                >
                  <RotateCw className={`w-5 h-5 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <Bell className="w-5 h-5 text-gray-500" />
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="hidden md:block">
                    <p className="text-sm font-semibold text-gray-900">Energy Manager</p>
                    <p className="text-xs text-gray-500">Administrator</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* 主內容區域 - 單一滾動容器，美化滾動條 */}
          <main
            className="flex-1 p-4 lg:p-8"
            style={{
              backgroundImage: `url('/images/skysails-bg.jpg')`,
              backgroundSize: '55%',
              backgroundRepeat: 'repeat-x',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed',
              minHeight: 'calc(100vh - 70px)',
              overflowY: 'auto',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(79, 70, 229, 0.3) transparent'
            }}
          >
            <style>
              {`
                main::-webkit-scrollbar {
                  width: 8px;
                }
                main::-webkit-scrollbar-track {
                  background: rgba(255, 255, 255, 0.1);
                  border-radius: 4px;
                }
                main::-webkit-scrollbar-thumb {
                  background: rgba(79, 70, 229, 0.3);
                  border-radius: 4px;
                  transition: all 0.3s ease;
                }
                main::-webkit-scrollbar-thumb:hover {
                  background: rgba(79, 70, 229, 0.5);
                }
              `}
            </style>
            {renderContent()}
          </main>
        </div>
      </div>

      {/* 移動端遮罩 */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default App;