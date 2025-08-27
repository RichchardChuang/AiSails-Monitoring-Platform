import React, { useState } from 'react';
import { Settings, Save, MapPin, Network, Plus, Trash2, Edit, Eye, EyeOff } from 'lucide-react';

// 獨立的彈出視窗組件（不使用 memo）
const AddSiteModal = ({ onClose, onAdd, newSite, setNewSite }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4">新增案場</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">案場名稱</label>
            <input
              type="text"
              value={newSite.name}
              onChange={(e) => setNewSite(prev => ({...prev, name: e.target.value}))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Site D"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">緯度</label>
              <input
                type="number"
                step="0.0001"
                value={newSite.lat}
                onChange={(e) => setNewSite(prev => ({...prev, lat: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="25.0330"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">經度</label>
              <input
                type="number"
                step="0.0001"
                value={newSite.lng}
                onChange={(e) => setNewSite(prev => ({...prev, lng: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="121.5654"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">描述</label>
            <input
              type="text"
              value={newSite.description}
              onChange={(e) => setNewSite(prev => ({...prev, description: e.target.value}))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="案場描述"
            />
          </div>
        </div>
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={onAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            新增
          </button>
        </div>
      </div>
    </div>
);

const SettingsPage = ({ currentSite, setCurrentSite, apiRequest }) => {
  const [activeTab, setActiveTab] = useState('network');
  const [showPassword, setShowPassword] = useState(false);
  const [newSite, setNewSite] = useState({ name: '', lat: '', lng: '', description: '' });
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [settings, setSettings] = useState({
    overview: {
      ip: ''
    },
    sbms: {
      ip: '',
      port: ''
    },
    pcs: {
      ip: '',
      port: ''
    },
    diesel: {
      ip: '',
      port: ''
    },
    pn14: {
      ip: '',
      port: ''
    }
  });

  // 從後端載入配置
  React.useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/load-config');
        const configData = await response.json();
        
        // 轉換後端資料格式以符合前端結構
        const formattedSettings = {
          overview: {
            ip: configData.overview?.overview_ip || ''
          },
          sbms: {
            ip: configData.devices?.sbms_ip || '',
            port: configData.devices?.sbms_port || ''
          },
          pcs: {
            ip: configData.devices?.pcs_ip || '',
            port: configData.devices?.pcs_port || ''
          },
          diesel: {
            ip: configData.devices?.diesel_ip || '',
            port: configData.devices?.diesel_port || ''
          },
          pn14: {
            ip: configData.devices?.pn14_ip || '',
            port: configData.devices?.pn14_port || ''
          }
        };
        
        setSettings(formattedSettings);
      } catch (error) {
        console.error('Failed to load config:', error);
        // 如果載入失敗，使用預設值
        setSettings({
          overview: { ip: '192.168.1.100' },
          sbms: { ip: '192.168.1.101', port: '8001' },
          pcs: { ip: '192.168.1.102', port: '8002' },
          diesel: { ip: '192.168.1.103', port: '8003' },
          pn14: { ip: '192.168.1.104', port: '8004' }
        });
      }
    };
    
    loadConfig();
  }, []);

  const [sites, setSites] = useState([
    {
      id: 1,
      name: 'Site 彰濱',
      lat: 24.098300,
      lng: 120.392965,
      description: '彰濱風力發電場',
      status: 'active'
    },
    {
      id: 2,
      name: 'Site 吉貝',
      lat: 23.755315,
      lng: 119.610501,
      description: '吉貝風力發電場',
      status: 'active'
    },
    {
      id: 3,
      name: 'Site 帛琉',
      lat: 7.358674, 
      lng: 134.562007,
      description: '帛琉風力發電場',
      status: 'maintenance'
    }
  ]);

  const handleSettingChange = (category, field, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  const handleSaveSettings = async () => {
    try {
      await apiRequest('/settings', {
        method: 'POST',
        body: JSON.stringify(settings)
      });
      alert('設定已儲存成功！');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('設定儲存失敗，請稍後再試。');
    }
  };

  const handleAddSite = () => {
    if (newSite.name && newSite.lat && newSite.lng) {
      const site = {
        id: sites.length + 1,
        ...newSite,
        lat: parseFloat(newSite.lat),
        lng: parseFloat(newSite.lng),
        status: 'active'
      };
      setSites(prev => [...prev, site]);
      setNewSite({ name: '', lat: '', lng: '', description: '' });
      setIsAddingSite(false);
    }
  };

  const handleDeleteSite = (id) => {
    // eslint-disable-next-line no-restricted-globals
    if (confirm('確定要刪除此案場嗎？')) {
      setSites(prev => prev.filter(site => site.id !== id));
    }
  };

  const handleSwitchSite = (siteName) => {
    setCurrentSite(siteName);
    alert(`已切換至 ${siteName}`);
  };

  const ConfigSection = ({ title, category, hasPort = true }) => (
    <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Network className="w-5 h-5 mr-2 text-blue-600" />
        {title}
      </h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">IP Address</label>
          <input
            type="text"
            value={settings[category]?.ip || ''}
            onChange={(e) => handleSettingChange(category, 'ip', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="192.168.1.xxx"
          />
        </div>
        {hasPort && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Port</label>
            <input
              type="text"
              value={settings[category]?.port || ''}
              onChange={(e) => handleSettingChange(category, 'port', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="8000"
            />
          </div>
        )}
        <div className="flex items-center space-x-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${
            settings[category]?.ip ? 'bg-green-500' : 'bg-gray-300'
          }`}></div>
          <span className="text-gray-600">
            {settings[category]?.ip ? 'Configuration set' : 'Not configured'}
          </span>
        </div>
      </div>
    </div>
  );

  const NetworkSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ConfigSection title="Overview" category="overview" hasPort={false} />
        <ConfigSection title="SBMS" category="sbms" />
        <ConfigSection title="PCS" category="pcs" />
        <ConfigSection title="DIESEL" category="diesel" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ConfigSection title="PN14" category="pn14" />
        <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">網路測試</h3>
          <div className="space-y-3">
            {Object.entries(settings).map(([key, config]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium capitalize">{key}</span>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    config.ip ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm text-gray-600">
                    {config.ip ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSaveSettings}
          className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>儲存設定</span>
        </button>
      </div>
    </div>
  );

  const SiteMap = React.memo(() => (
    <div className="space-y-6">
      <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-green-600" />
            案場地圖設定
          </h3>
          <button
            onClick={() => setIsAddingSite(true)}
            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>新增案場</span>
          </button>
        </div>

        {/* 案場列表 */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">案場列表</h4>
          <div className="grid grid-cols-1 gap-4">
            {sites.map((site) => (
              <div key={site.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className={`w-3 h-3 rounded-full ${
                    site.status === 'active' ? 'bg-green-500' :
                    site.status === 'maintenance' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <div>
                    <h5 className="font-medium text-gray-900">{site.name}</h5>
                    <p className="text-sm text-gray-600">{site.description}</p>
                    <p className="text-xs text-gray-500">
                      座標: {site.lat.toFixed(4)}, {site.lng.toFixed(4)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleSwitchSite(site.name)}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      currentSite === site.name 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {currentSite === site.name ? '目前案場' : '切換'}
                  </button>
                  <button
                    onClick={() => handleDeleteSite(site.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  ));

  const SystemSettings = () => (
    <div className="space-y-6">
      <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-6">系統偏好設定</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">資料更新頻率</label>
            <select 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              defaultValue="3"
            >
              <option value="1">1 秒</option>
              <option value="3">3 秒</option>
              <option value="5">5 秒</option>
              <option value="10">10 秒</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">語言設定</label>
            <select 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              defaultValue="zh-TW"
            >
              <option value="zh-TW">繁體中文</option>
              <option value="zh-CN">简体中文</option>
              <option value="en">English</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">時區設定</label>
            <select 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              defaultValue="Asia/Taipei"
            >
              <option value="Asia/Taipei">Asia/Taipei (UTC+8)</option>
              <option value="UTC">UTC (UTC+0)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">主題設定</label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input type="radio" name="theme" value="light" defaultChecked className="mr-2" />
                <span>淺色主題</span>
              </label>
              <label className="flex items-center">
                <input type="radio" name="theme" value="dark" className="mr-2" />
                <span>深色主題</span>
              </label>
              <label className="flex items-center">
                <input type="radio" name="theme" value="auto" className="mr-2" />
                <span>自動</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-6">告警設定</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="font-medium">電子郵件通知</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="font-medium">SMS 簡訊通知</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="font-medium">系統聲音提醒</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-6">資料備份</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">自動備份</p>
              <p className="text-sm text-gray-600">每日自動備份系統資料</p>
            </div>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              立即備份
            </button>
          </div>
          
          <div className="text-sm text-gray-600">
            <p>上次備份時間: 2025-08-12 02:00:00</p>
            <p>備份檔案大小: 25.6 MB</p>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'network', label: '網路設定', component: NetworkSettings },
    { id: 'sitemap', label: '案場位置設定', component: SiteMap },
    // { id: 'system', label: '系統設定', component: SystemSettings }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || NetworkSettings;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">系統設定</h2>
        <p className="text-purple-100">系統參數配置與案場管理</p>
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
                  ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
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

      {/* 新增案場表單 - 放在最外層並條件渲染 */}
      {activeTab === 'sitemap' && isAddingSite && (
        <AddSiteModal 
          onClose={() => setIsAddingSite(false)}
          onAdd={handleAddSite}
          newSite={newSite}
          setNewSite={setNewSite}
        />
      )}
    </div>
  );
};

export default SettingsPage;