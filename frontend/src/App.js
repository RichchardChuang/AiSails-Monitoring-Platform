import React, { useState, useEffect } from 'react';
import { Wind, Battery, Zap, Fuel,RotateCw , AlertTriangle, CheckCircle, Activity, TrendingUp, Settings, BarChart3, Gauge, Menu, X, User, Search, Bell, FileText, Moon, Sun } from 'lucide-react';
import { PublicClientApplication } from '@azure/msal-browser';

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
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState(null);

  const [currentSite, setCurrentSite] = useState('Site 彰濱');
  const [realTimeData, setRealTimeData] = useState({
    skysails: {
      windSpeed: 0,  // pn14.wind
      tension: 0,  // pn14.force
      status: 'standby'  // pn14.status
    },
    ess: {
      switch: false,  // sbms.active
      status: 'status',  // 系統狀態 sbms.active   it seem like status is derived from active
      chargeStatus: 'status',  // 充放電狀態 sbms.active Charge discharge state  it seem like status is derived from active

      voltage: 0,  // sbms.voltage
      current: 0,  // sbms.current
      rack1: {
        temperature: 0  // sbms.rack1.temperature
      },
      rack2: {
        temperature: 0  // sbms.rack2.temperature
      },
      rack3: {
        temperature: 0  // sbms.rack3.temperature
      },
      rack4: {
        temperature: 0  // sbms.rack4.temperature
      },
      soc: 0,  // sbms.soc
      soh: 0, // sbms.soh
      ups: {
        status: 'normal',  // sbms.connected
        ups_batteryvoltage: 0, //sbms.ups_batteryvoltage
        ups_capacity: 0, //sbms.ups_capacity
        ups_involtage: 0, //sbms.ups_involtage
        ups_loadpercent: 0, //sbms.ups_loadpercent
        ups_outcurrent: 0, //sbms.ups_outcurrent
        ups_outpower: 0, //sbms.ups_outpower
        ups_outvoltage: 0, //sbms.ups_outvoltage
        ups_status: "Running", //sbms.ups_status
      },
      //Air Conditioner 空調系統
      aircon: {
        humidity: 0,  // Ess.ac_humidity 濕度
        mode: 'N/A',  // Ess.ac_mode 模式: 暖氣/冷氣
        status: 'N/A',  // Ess.ac_status 狀態: 運轉/停止
        temperature: 0,  // Ess.ac_temperature 溫度
      },
      pcs: {
        status: 'normal',  // pcs.connected 連線狀態
        current: 0,  // pcs.current 充電電流
        dcLinkVoltage: 0,  // pcs.dcvoltage DC-Link電壓(直流電壓)
        fault: '正常',  // pcs.fault 故障代碼
        frequency: 0,  // pcs.frequency 目標頻率
        voltage: 0,  // pcs.linevoltage 偵測電壓
        gauge: {
        max: 60.23, //最高目標頻率設定
        min: 59.77, // 最低目標頻率設定
        target: 60, // 目標頻率
        zone_high: 60.02, // 頻率高警戒值
        zone_low: 59.9 // 頻率低警戒值
        },
        gridStatus: 'N/A',  // pcs.gridstatus 微電網狀態
        ip: "192.168.127.231", // PCS設備位置
        lineFrequency: 0,  // pcs.linefrequency 偵測頻率
        lineVoltage: 0,  // pcs.linevoltage 偵測電壓
        name: "PCS", // PCS設備名稱
        operatingMode: '微電網',  // pcs.operationmode 運作模式
        pcsStatus: 'standby',  // pcs.pcsstatus 充放電狀態
        port: 502, // PCS通訊埠
        power: 0,  // 計算自 pcs.power 輸出功率
        supplyFrequency: 0,  // pcs.supplyfrequency 輸出頻率
        temperature: 0,  // pcs.temperature 溫度
      }
    },
    diesel: {
      engineSwitch: false,  // diesel.status (includes 'Started')
      status: {
        started: false,
        mode: 0,  // diesel.status (includes 'Auto') ? 0 : 1
        acb: 0,  // diesel.status (includes 'OFF') ? 0 : 1
        manual_mode: false, // diesel.status.manual_mode === true ? "手動" : "自動"
        frequency: 0,  // diesel.frequency
        oilPressure: 0,  // diesel.oilpressure
        coolantTemp: 0,  // diesel.coolertemperature
        fuel: 0  // diesel.fuel
      },
      power: {
        l1Power: 0,  // diesel.l1power
        l2Power: 0,  // diesel.l2power
        l3Power: 0,  // diesel.l3power
        l1Voltage: 0,  // diesel.l1l2voltage
        l2Voltage: 0,  // diesel.l2l3voltage
        l3Voltage: 0,  // diesel.l3l1voltage
        l1Current: 0,  // diesel.l1current
        l2Current: 0,  // diesel.l2current
        l3Current: 0  // diesel.l3current
      },
      other: {
        batteryVoltage: 0,  // diesel.batteryvoltage
        fieldVoltage: 0,  // diesel.chargemagneticvoltage
        temperature: 0,  // diesel.temperature
        power: 0  // diesel.power
      }
    },
    pn14:{
      connected: false,
      details: {},
    },
  });

  // 自動清除認證錯誤 (10秒後)
  useEffect(() => {
    if (authError) {
      const timer = setTimeout(() => {
        setAuthError(null);
      }, 10000); // 10秒

      return () => clearTimeout(timer);
    }
  }, [authError]);

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
            //Air Conditioner 空調系統
            ac_humidity: 70,
            ac_mode: "Cooling",
            ac_status: "Running",
            ac_temperature: 30,
            // ESS Battery 外層控制
            switch: data.devices.sbms?.active || false,
            status: data.devices.sbms?.active || "N/A",
            chargeStatus: data.devices.sbms?.status || "N/A",
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
            soc: data.devices.sbms?.soc || 0, // sbms.soc 
            soh: data.devices.sbms?.soh || 0, // sbms.soh 電池的健康狀態
            // UPS 系統
            ups: {
              status: data.devices.sbms?.connected ? 'normal' : 'offline',
              ups_batteryvoltage: data.devices.sbms?.ups_batteryvoltage || 0,
              ups_capacity: data.devices.sbms?.ups_capacity || 0,
              ups_involtage: data.devices.sbms?.ups_involtage || 0,
              ups_loadpercent: data.devices.sbms?.ups_loadpercent || 0,
              ups_outcurrent: data.devices.sbms?.ups_outcurrent || 0,
              ups_outpower: data.devices.sbms?.ups_outpower || 0,
              ups_outvoltage: data.devices.sbms?.ups_outvoltage || 0,
              ups_status: data.devices.sbms?.ups_status || 'N/A',
            },

            // 空調系統 (暫時使用假數據，因為後端沒有相關數據)
            aircon: {
              humidity: data.devices.sbms?.ac_humidity || 0,
              mode: data.devices.sbms?.ac_mode || 'N/A',
              status: data.devices.sbms?.ac_status || 'N/A',
              temperature: data.devices.sbms?.ac_temperature || 0,
            },
            // PCS 頻率控制
            pcs: {
              frequency: data.devices.pcs?.frequency || 0,
              dcLinkVoltage: data.devices.pcs?.dcvoltage || 0,
              voltage: data.devices.pcs?.linevoltage || 0,
              current: data.devices.pcs?.current || 0,
              status: data.devices.pcs?.connected ? 'normal' : 'offline',
              power: data.devices.pcs?.power || 0,
              operatingMode: data.devices.pcs?.operationmode|| 'N/A',
              pcsStatus: data.devices.pcs?.pcsstatus === 1 ? 'charging' : 'standby',
              gridStatus: data.devices.pcs?.gridstatus || 'N/A',
              supplyFrequency: data.devices.pcs?.supplyfrequency || 0,
              fault: data.devices.pcs?.fault || 'Not found',
              lineVoltage: data.devices.pcs?.linevoltage || 0,
              lineFrequency: data.devices.pcs?.linefrequency || 0,
              temperature: data.devices.pcs?.temperature || 0
            }
          },
          diesel: {
            engineSwitch: data.devices.diesel?.started || false,
            status: {
              started: data.devices.diesel?.started || false,
              // mode: data.devices.diesel?.status?.includes('Auto') ? 0 : 1,
              manual_mode: data.devices.diesel?.manual_mode === true ? "手動" : "自動3",
              acb: data.devices.diesel?.status?.includes('OFF') ? 0 : 1,
              frequency: data.devices.diesel?.frequency || 0,
              oilPressure: data.devices.diesel?.oilpressure || 0,
              coolantTemp: data.devices.diesel?.coolertemperature || 0,
              fuel: data.devices.diesel?.fuel || 'N/A'
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
          },
          pn14: {
            connected: data.devices.pn14?.connected !== false,
            details: data.devices.pn14 || {},
          },
        }));
      }
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch device status:', err);
      throw err;
    }
  };

  // 初始化 MSAL 並自動登入
  useEffect(() => {
    const initializeMsal = async () => {
      try {
        console.log('開始初始化 MSAL...');
        setAuthError(null);

        // 從後端獲取 MSAL 配置
        console.log('正在獲取 AAD 配置...');
        const response = await fetch('/aad-config');
        const config = await response.json();
        console.log('AAD 配置:', config);

        const { clientId, authority, redirectUri } = config;

        // 創建 MSAL 實例
        console.log('正在創建 MSAL 實例...');
        const msalApp = new PublicClientApplication({
          auth: {
            clientId,
            authority,
            redirectUri
          }
        });

        await msalApp.initialize();
        console.log('MSAL 實例已初始化');

        // 進入網頁時自動啟動 MSAL 登入
        console.log('正在啟動登入彈窗...');
        try {
          const loginResponse = await msalApp.loginPopup({
            scopes: ["User.Read", "openid", "profile", "email"]
          });
          console.log('登入成功:', loginResponse);
          const account = loginResponse.account;

          setCurrentUser({
            username: account.username || account.name,
            name: account.name,
            email: account.username,
            account: account
          });
          setIsAuthenticated(true);

        } catch (loginError) {
          console.error("登入失敗:", loginError);
          setAuthError(`登入失敗: ${loginError.message}`);
          setIsAuthenticated(false);
        }

      } catch (configError) {
        console.error('無法獲取 AAD 配置:', configError);
        setAuthError(`無法獲取 AAD 配置: ${configError.message}`);
      }
    };

    initializeMsal();
  }, []);

  // 模擬實時數據更新
  useEffect(() => {
    // 初始載入時不顯示 loading overlay，靜默載入
    const initialFetch = async () => {
      try {
        await fetchDeviceStatus();
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.log('API not available, using simulated data in development mode.');
        } else {
          console.error('API connection failed:', err);
          setError(`連線失敗：無法連接到後端服務 (${err.message})`);
        }
      }
    };

    initialFetch();

    // 定時靜默更新（不顯示 loading overlay）
    const interval = setInterval(() => {
      // 直接呼叫 fetchDeviceStatus，不經過 fetchAllSystemData
      fetchDeviceStatus().catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          // 開發模式：使用模擬數據更新
          console.log('Using simulated data in development mode');
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
        } else {
          // 生產模式：顯示錯誤訊息
          console.error('Failed to fetch device status:', err);
          setError(`資料更新失敗：無法連接到後端服務器`);
        }
      });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'skysails', label: 'SkySails PN14', icon: Wind },
    { id: 'ess', label: 'ESS Battery', icon: Battery },
    { id: 'diesel', label: 'Diesel Gen', icon: Fuel },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'etica', label: 'ETICA ESS', icon: Zap }
  ];

  // 錯誤顯示組件
  const ErrorMessage = () => {
    return (
      <>
        {error && (
          <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg z-50">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Internet Error: {error}</span>
            </div>
          </div>
        )}
        {authError && (
          <div className="fixed top-16 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg shadow-lg z-50">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">認證錯誤: {authError}</span>
            </div>
          </div>
        )}
      </>
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
      handleCommandExecute,
      isDarkMode
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
          isDarkMode={isDarkMode}
        />;
      case 'settings':
        return <SettingsPage {...props} />;
      case 'etica':
        return (
          <div className="w-full h-full" style={{ minHeight: 'calc(100vh - 150px)' }}>
            <iframe
              src="http://192.168.127.246/#/"
              title="ETICA ESS"
              className="w-full h-full border-0 rounded-lg"
              style={{ minHeight: 'calc(100vh - 150px)' }}
            />
          </div>
        );
      default:
        return <Dashboard {...props} />;
    }
  };

  return (
    <div
      className="min-h-screen"
      style={isDarkMode ? {
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        // filter: 'brightness(0.4)',
      } : {}}
    >
      <ErrorMessage />
      {/* <LoadingOverlay /> */}

      <div className="flex h-screen">
        {/* 側邊欄 - 固定高度，獨立滾動 */}
        {/*
          響應式寬度設計：
          - < 500px: 完全隱藏，透過漢堡選單開關 (fixed + transform，不佔空間)
          - 500px ~ 1024px: 只顯示圖示，不顯示文字 (w-16, sticky)
          - >= 1024px: 完整顯示圖示和文字 (w-56, sticky)
        */}
        <div className={`max-[499px]:fixed max-[499px]:inset-y-0 max-[499px]:left-0 max-[499px]:z-50 max-[499px]:w-56 flex-shrink-0 transform ${isSidebarOpen ? 'translate-x-0' : 'max-[499px]:-translate-x-full'} transition-all duration-300 ease-in-out min-[500px]:translate-x-0 min-[500px]:sticky min-[500px]:top-0 min-[500px]:h-screen min-[500px]:w-16 lg:w-56 flex flex-col relative overflow-hidden ${
          isDarkMode ? '' : 'bg-gradient-to-b from-slate-950 to-indigo-700'
        }`}>
          {/* 夜間模式的背景圖片層 */}
          {isDarkMode && (
            <div
              className="absolute inset-0 -z-10"
              style={{
                backgroundImage: `url('/images/skysails-bg.jpg')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'brightness(0.4)',
              }}
            />
          )}
          {/* 頂部標題區域 - 固定不滾動 */}
          <div className={`flex items-center justify-center border-b flex-shrink-0 ${
            isDarkMode ? 'border-gray-700/50' : 'border-indigo-700'
          } ${isSidebarOpen ? 'p-6' : 'py-4 px-2 min-[500px]:px-2 lg:p-6'}`}>
            <div className="flex items-center justify-center w-full">
              {/* 完整 Logo - 大螢幕顯示 */}
              <div className="hidden lg:block w-full">
                <h1 className="text-lg font-bold text-white mb-3">
                  <img src="\images\aisails-logo.png" className="w-25 h-8" alt="AiSails Logo" />
                </h1>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-indigo-200'}`}>{currentSite}</p>
              </div>

              {/* 中等螢幕 - 顯示縮小的 Logo */}
              <div className="hidden min-[500px]:flex lg:hidden items-center justify-center">
                <img src="\images\aisails-logo.png" className="h-6 w-auto" alt="AiSails Logo" />
              </div>

              {/* 小螢幕 - 顯示小 Logo（漢堡選單打開時） */}
              <div className={`min-[500px]:hidden flex items-center justify-center ${!isSidebarOpen && 'hidden'}`}>
                <img src="\images\aisails-logo.png" className="h-6 w-auto" alt="AiSails Logo" />
              </div>
            </div>

            <button
              onClick={() => setIsSidebarOpen(false)}
              className="min-[500px]:hidden text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-1 absolute right-2 top-4"
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
                      className={`w-full flex items-center min-[500px]:justify-center lg:justify-start space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                        selectedCategory === item.id
                          ? `${isDarkMode ? 'bg-gray-800' : 'bg-white bg-opacity-20'} text-white shadow-lg`
                          : `${isDarkMode ? 'text-gray-400 hover:bg-gray-800' : 'text-indigo-200 hover:bg-white hover:bg-opacity-10'} hover:text-white`
                      }`}
                      title={item.label}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium max-[499px]:inline min-[500px]:hidden lg:inline">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* 主要內容區域 - 左邊留出側邊欄空間，移除多重滾動 */}
        <div className="flex-1 min-w-0 flex flex-col h-screen">
          {/* 頂部導航 - 固定不滾動 */}
          <header className="bg-blue-/70 shadow-sm border-b border-gray-200 px-2 sm:px-4 lg:px-8 py-3 sm:py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-4">
                {/* 漢堡選單只在 < 500px 顯示 */}
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className={`min-[500px]:hidden ${isDarkMode ? 'text-gray-300 hover:text-gray-500' : 'text-gray-800 hover:text-gray-900'}`}
                >
                  <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
                <h2 className={`text-lg sm:text-xl lg:text-2xl font-bold capitalize ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {selectedCategory === 'skysails' ? 'SkySails PN14' :
                    selectedCategory === 'ess' ? 'ESS Battery' :
                      selectedCategory === 'diesel' ? 'Diesel Generator' :
                        selectedCategory === 'etica' ? 'ETICA ESS' :
                          selectedCategory}
                </h2>
                {error && (
                  <span className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
                    API Offline
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4">
                <button
                  onClick={fetchAllSystemData}
                  className={`p-1.5 sm:p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                  title="Refresh data"
                >
                  <RotateCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-800'} ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className={`p-1.5 sm:p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                  title={isDarkMode ? '切換至日間模式' : '切換至夜間模式'}
                >
                  {isDarkMode ? (
                    <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                  ) : (
                    <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-800" />
                  )}
                </button>
                <Bell className={`w-4 h-4 sm:w-5 sm:h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-800'} hidden sm:block`} />
                <div className="hidden sm:flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="hidden md:block">
                    {isAuthenticated && currentUser ? (
                      <>
                        <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{currentUser.name || currentUser.username}</p>
                        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-800'}`}>已驗證</p>
                      </>
                    ) : (
                      <>
                        <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Energy Manager</p>
                        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-800'}`}>未驗證</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* 主內容區域 - 單一滾動容器，美化滾動條 */}
          <main
            className={`flex-1 ${selectedCategory === 'etica' ? 'p-0' : 'p-2 sm:p-4 lg:p-8'} relative overflow-hidden`}
            style={{
              overflowY: 'auto',
              scrollbarWidth: 'thin',

              scrollbarColor: isDarkMode ? 'rgba(156, 163, 175, 0.3) transparent' : 'rgba(79, 70, 229, 0.3) transparent'
            }}
          >
            {/* 背景圖片層 */}
            <div
              className="fixed inset-0 -z-10"
              style={{
                              backgroundImage: `url('/images/skysails-bg.jpg')`,
                backgroundSize: 'auto 100%',
                backgroundPosition: 'center center',
                backgroundRepeat: 'repeat-x',
                backgroundAttachment: 'fixed',
                filter: isDarkMode ? 'brightness(0.4)' : 'brightness(1)',
                transition: 'filter 0.3s ease',
              }}
            />
            <style>
              {`
                main::-webkit-scrollbar {
                  width: 8px;
                }
                main::-webkit-scrollbar-track {
                  background: ${isDarkMode ? 'rgba(31, 41, 55, 0.5)' : 'rgba(255, 255, 255, 0.1)'};
                  border-radius: 4px;
                }
                main::-webkit-scrollbar-thumb {
                  background: ${isDarkMode ? 'rgba(156, 163, 175, 0.3)' : 'rgba(79, 70, 229, 0.3)'};
                  border-radius: 4px;
                  transition: all 0.3s ease;
                }
                main::-webkit-scrollbar-thumb:hover {
                  background: ${isDarkMode ? 'rgba(156, 163, 175, 0.5)' : 'rgba(79, 70, 229, 0.5)'};
                }
              `}
            </style>
            {renderContent()}
          </main>
        </div>
      </div>

      {/* 移動端遮罩 - 只在 < 500px 顯示 */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 min-[500px]:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default App;