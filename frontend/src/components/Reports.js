import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, Filter, Search, Calendar, Power, ToggleLeft, ToggleRight, AlertTriangle, CheckCircle, Activity, RefreshCw } from 'lucide-react';

const Reports = ({ realTimeData, apiRequest, isDarkMode }) => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const logsEndRef = useRef(null);
  const alertsEndRef = useRef(null);

  // 從後端定期抓取 logs
  const fetchLogs = async () => {
    try {
      const response = await fetch('/logs');
      if (response.ok) {
        const backendLogs = await response.json();
        console.log('從後端收到的 logs 數量:', backendLogs.length);
        console.log('前 3 筆 logs:', backendLogs.slice(0, 3));

        // 將後端的 log 格式轉換為前端格式
        const formattedLogs = backendLogs.map((logMessage, index) => {
          // 解析 log 訊息格式：
          // 成功: "[2025-08-26 14:18:54] Action power_on_sbms executed in 20.01 seconds"
          // 錯誤: "[2025-08-27 15:22:46] Error executing action power_on_sbms: error message"

          const timestampMatch = logMessage.match(/\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]/);
          const isError = logMessage.includes('Error executing action');

          let actionName = '';
          let status = 'success';
          let details = logMessage;
          let executionTime = '';

          if (isError) {
            // 解析錯誤訊息：Error executing action {action_name}: {error_message}
            const errorMatch = logMessage.match(/Error executing action (\w+):\s*(.+)/);
            if (errorMatch) {
              actionName = errorMatch[1];
              details = errorMatch[2] || logMessage;
            }
            status = 'error';
          } else {
            // 解析成功訊息：Action {action_name} executed in {time} seconds
            const actionMatch = logMessage.match(/Action (\w+) executed in ([\d.]+) seconds/);
            if (actionMatch) {
              actionName = actionMatch[1];
              executionTime = actionMatch[2];
              details = `執行成功，耗時 ${executionTime} 秒`;
            }
          }

          // 從 action 名稱推斷設備類型
          let deviceType = 'system';
          if (actionName.includes('sbms') || actionName.includes('dc') || actionName.includes('precharge')) {
            deviceType = 'sbms';
          } else if (actionName.includes('pcs') || actionName.includes('freq')) {
            deviceType = 'pcs';
          } else if (actionName.includes('dg') || actionName.includes('diesel') || actionName.includes('acb')) {
            deviceType = 'diesel';
          } else if (actionName.includes('microgrid')) {
            deviceType = 'system';
          }

          return {
            id: `backend-${Date.now()}-${index}`,
            timestamp: timestampMatch ? new Date(timestampMatch[1]).toISOString() : new Date().toISOString(),
            system: getSystemName(deviceType),
            operation: getOperationName(actionName),
            component: getComponentName(deviceType, actionName),
            user: 'System',
            status: status,
            details: details,
            command: actionName,
            executionTime: executionTime,
            isFromBackend: true
          };
        });

        console.log('解析後的 logs 數量:', formattedLogs.length);
        console.log('前 3 筆解析後的 logs:', formattedLogs.slice(0, 3));

        // 合併後端 logs 和本地 logs，去重（使用完整訊息作為唯一鍵）
        setLogs(prev => {
          const existingKeys = new Set(prev.map(log => `${log.timestamp}-${log.command}`));
          const newLogs = formattedLogs.filter(log => !existingKeys.has(`${log.timestamp}-${log.command}`));
          const allLogs = [...newLogs, ...prev].sort((a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
          );
          console.log('設置後的總 logs 數量:', allLogs.length);
          return allLogs;
        });
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  // 初始化和定期抓取
  useEffect(() => {
    // 載入初始日誌
    fetchLogs();
    
    // 設定定期抓取（每3秒）
    const interval = setInterval(fetchLogs, 300000);
    
    // 清理函數
    return () => clearInterval(interval);
  }, []);

  // 滾動到最新的警告
  useEffect(() => {
    alertsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [alerts]);

  // 發送控制命令到後端
  const sendCommand = async (device, action) => {
    setIsExecuting(true);
    const timestamp = new Date().toISOString();
    
    // 添加執行中的日誌
    const executingLog = {
      id: logs.length + 1,
      timestamp,
      system: getSystemName(device),
      operation: getOperationName(action),
      component: getComponentName(device, action),
      user: 'Operator',
      status: 'pending',
      details: `執行命令: ${device} ${action}`,
      command: `${device} ${action}`
    };
    
    setLogs(prev => [...prev, executingLog]);

    try {
      const response = await fetch('/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device, action })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // 更新日誌狀態為成功
        setLogs(prev => prev.map(log => 
          log.id === executingLog.id 
            ? { ...log, status: 'success', details: result.message || 'Command executed successfully' }
            : log
        ));
        
        // 添加成功提示到警告區
        setAlerts(prev => [...prev, {
          id: prev.length + 1,
          timestamp: new Date().toISOString(),
          message: `✓ ${result.message || 'Command executed successfully'}`,
          type: 'success'
        }]);
      } else {
        // 更新日誌狀態為錯誤
        setLogs(prev => prev.map(log => 
          log.id === executingLog.id 
            ? { ...log, status: 'error', details: result.error || 'Command execution failed' }
            : log
        ));
        
        // 添加錯誤警告
        setAlerts(prev => [...prev, {
          id: prev.length + 1,
          timestamp: new Date().toISOString(),
          message: `✗ ${result.error || 'Command execution failed'}`,
          type: 'error'
        }]);
      }
    } catch (error) {
      // 更新日誌狀態為錯誤
      setLogs(prev => prev.map(log => 
        log.id === executingLog.id 
          ? { ...log, status: 'error', details: 'Unable to connect to backend service' }
          : log
      ));
      
      // 添加連接錯誤警告
      setAlerts(prev => [...prev, {
        id: prev.length + 1,
        timestamp: new Date().toISOString(),
        message: '✗ 無法連接到後端服務',
        type: 'error'
      }]);
      
      console.error('Error sending command:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  // 輔助函數：獲取系統名稱
  const getSystemName = (device) => {
    const names = {
      'skysails': 'SkySails PN14',
      'sbms': 'ESS Battery (SBMS)',
      'pcs': 'PCS System',
      'diesel': 'Diesel Generator',
      'system': 'System Control'
    };
    return names[device] || device;
  };

  // 輔助函數：獲取操作名稱
  const getOperationName = (action) => {
    const operations = {
      'operation': 'Power ON',
      'shutdown': 'Power OFF',
      'start_dg': 'Start Generator',
      'stop_dg': 'Stop Generator',
      'acb_open': 'ACB Open',
      'acb_close': 'ACB Close',
      'clear_sbms_fault': 'Clear SBMS Fault',
      'pcs_fault_reset': 'PCS Fault Reset',
      'pcs_freq_up': 'Frequency Up',
      'pcs_freq_down': 'Frequency Down',
      'pcs_freq_reset': 'Frequency Reset',
      'pcs_run_microgrid': 'Run Microgrid',
      'pcs_stop_microgrid': 'Stop Microgrid',
      'pcs_read_summary': 'Read PCS Summary',
      'power_on_sbms': 'Power ON SBMS',
      'power_off_sbms': 'Power OFF SBMS',
      'open_dc_switch': 'Open DC Switch',
      'close_dc_switch': 'Close DC Switch',
      'close_pcs_switch': 'Close PCS Switch',
      'close_precharge_switch': 'Close Precharge',
      'run_microgrid': 'Run Microgrid (Full)',
      'start_microgrid': 'Start Microgrid',
      'stop_microgrid': 'Stop Microgrid'
    };
    return operations[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // 輔助函數：獲取組件名稱
  const getComponentName = (device, action) => {
    if (device === 'pcs' && action.includes('freq')) return 'Frequency Control';
    if (device === 'diesel' && action.includes('dg')) return 'Engine Control';
    if (device === 'sbms') return 'Battery Management';
    if (device === 'skysails') return 'Wind Power System';
    return 'System Control';
  };

  // 過濾日誌
  useEffect(() => {
    let filtered = logs;

    // 按狀態過濾
    if (filterType !== 'all') {
      filtered = filtered.filter(log => log.status === filterType);
    }

    // 按搜索詞過濾
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.system.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.operation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.component.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 按日期範圍過濾
    const now = new Date();
    if (dateRange === 'custom') {
      // 自訂日期範圍
      if (startDate || endDate) {
        filtered = filtered.filter(log => {
          const logDate = new Date(log.timestamp);
          const start = startDate ? new Date(startDate) : null;
          const end = endDate ? new Date(endDate) : null;

          // 設定結束日期為當天的 23:59:59
          if (end) {
            end.setHours(23, 59, 59, 999);
          }

          if (start && end) {
            return logDate >= start && logDate <= end;
          } else if (start) {
            return logDate >= start;
          } else if (end) {
            return logDate <= end;
          }
          return true;
        });
      }
    } else if (dateRange === 'today') {
      filtered = filtered.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate.toDateString() === now.toDateString();
      });
    } else if (dateRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(log => new Date(log.timestamp) >= weekAgo);
    } else if (dateRange === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(log => new Date(log.timestamp) >= monthAgo);
    }

    setFilteredLogs(filtered);
    // 當過濾條件改變時，重置到第一頁
    setCurrentPage(1);
  }, [logs, filterType, searchTerm, dateRange, startDate, endDate]);

  // 計算分頁資料
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLogs = filteredLogs.slice(startIndex, endIndex);

  // 分頁控制
  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'pending': return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      success: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
      pending: 'bg-blue-100 text-blue-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status === 'pending' ? 'EXECUTING' : status.toUpperCase()}
      </span>
    );
  };

  const exportLogs = () => {
    const csvContent = [
      ['Timestamp', 'System', 'Operation', 'Component', 'User', 'Status', 'Details', 'Command'],
      ...filteredLogs.map(log => [
        new Date(log.timestamp).toLocaleString(),
        log.system,
        log.operation,
        log.component,
        log.user,
        log.status,
        log.details,
        log.command || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `operation_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const OperationSummary = () => {
    const summary = logs.reduce((acc, log) => {
      acc.total++;
      if (log.status !== 'pending') {
        acc[log.status] = (acc[log.status] || 0) + 1;
      }
      return acc;
    }, { total: 0, success: 0, warning: 0, error: 0 });

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} font-medium`}>Total Operations</p>
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{summary.total}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} font-medium`}>Successful</p>
              <p className="text-2xl font-bold text-green-600">{summary.success || 0}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} font-medium`}>Warnings</p>
              <p className="text-2xl font-bold text-yellow-600">{summary.warning || 0}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} font-medium`}>Errors</p>
              <p className="text-2xl font-bold text-red-600">{summary.error || 0}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>
    );
  };

  // 警告訊息和執行紀錄區塊
  const LogsAndAlerts = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* 警告訊息 */}
      <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold flex items-center ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            <AlertTriangle className="w-5 h-5 mr-2 text-yellow-500" />
            警告訊息
          </h3>
          <button
            onClick={() => setAlerts([])}
            className={`text-sm ${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
          >
            清除
          </button>
        </div>
        <div className={`h-48 overflow-y-auto border ${isDarkMode ? 'border-gray-700' : 'border-gray-100'} rounded-lg p-3`}>
          {alerts.length === 0 ? (
            <p className={`${isDarkMode ? 'text-gray-500' : 'text-gray-400'} text-center py-8`}>暫無警告訊息</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-2 rounded-lg text-sm ${
                    alert.type === 'error' ? 'bg-red-50 text-red-700' :
                    alert.type === 'success' ? 'bg-green-50 text-green-700' :
                    'bg-blue-50 text-blue-700'
                  }`}
                >
                  <span className="text-xs text-gray-500">
                    [{new Date(alert.timestamp).toLocaleTimeString('zh-TW')}]
                  </span>
                  <p className="font-medium">{alert.message}</p>
                </div>
              ))}
              <div ref={alertsEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* 執行紀錄 */}
      <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold flex items-center ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            <Activity className="w-5 h-5 mr-2 text-blue-500" />
            執行紀錄
          </h3>
          <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            最近 {Math.min(logs.length, 10)} 筆
          </span>
        </div>
        <div className={`h-48 overflow-y-auto border ${isDarkMode ? 'border-gray-700' : 'border-gray-100'} rounded-lg p-3`}>
          {logs.length === 0 ? (
            <p className={`${isDarkMode ? 'text-gray-500' : 'text-gray-400'} text-center py-8`}>暫無執行紀錄</p>
          ) : (
            <div className="space-y-2">
              {[...logs].slice(0,10).map((log) => (
                <div
                  key={log.id}
                  className={`p-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'} last:border-0`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      [{new Date(log.timestamp).toLocaleString('zh-TW')}]
                    </span>
                    {getStatusIcon(log.status)}
                  </div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    執行命令: {log.command}
                  </p>
                  <p className={`text-xs ${
                    log.status === 'success' ? 'text-green-600' :
                    log.status === 'error' ? 'text-red-600' :
                    log.status === 'pending' ? 'text-blue-600' :
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {log.details}
                  </p>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // 測試控制按鈕（可選，用於測試後端連接）
  const TestControls = () => (
    <div className="bg-white/70 rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
      <h3 className="text-lg font-semibold mb-4">快速控制測試</h3>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => sendCommand('skysails', 'operation')}
          disabled={isExecuting}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          SkySails ON
        </button>
        <button
          onClick={() => sendCommand('sbms', 'power_on_sbms')}
          disabled={isExecuting}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          SBMS Power ON
        </button>
        <button
          onClick={() => sendCommand('pcs', 'pcs_freq_reset')}
          disabled={isExecuting}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          PCS Freq Reset
        </button>
        <button
          onClick={() => sendCommand('diesel', 'start_dg')}
          disabled={isExecuting}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Start Diesel
        </button>
      </div>
      {isExecuting && (
        <p className="text-sm text-blue-600 mt-2 flex items-center">
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          執行中...
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r  from-blue-600 to-blue-800 rounded-xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">Operation Reports</h2>
        <p className="text-blue-100">系統操作日誌與開關狀態記錄</p>
      </div>

      <OperationSummary />

      {/* 警告訊息和執行紀錄 */}
      <LogsAndAlerts />

      {/* 測試控制按鈕（開發時使用） */}
      {/* {process.env.NODE_ENV === 'development' && <TestControls />} */}

      {/* 過濾和搜索控制 */}
      <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl p-6 shadow-sm border`}>
        <div className="space-y-4">
          {/* 第一排：狀態過濾和日期範圍 */}
          <div className="flex flex-col lg:flex-row lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className={`${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-200'
                    : 'bg-white border-gray-200 text-gray-900'
                } border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="pending">Executing</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <Calendar className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <select
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value);
                  if (e.target.value !== 'custom') {
                    setStartDate('');
                    setEndDate('');
                  }
                }}
                className={`${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-200'
                    : 'bg-white border-gray-200 text-gray-900'
                } border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="all">All Time</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          </div>

          {/* 第二排：自訂日期範圍（當選擇 Custom Range 時顯示） */}
          {dateRange === 'custom' && (
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="flex items-center space-x-2">
                <label className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  開始日期:
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-200'
                      : 'bg-white border-gray-200 text-gray-900'
                  } border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              <div className="flex items-center space-x-2">
                <label className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  結束日期:
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-200'
                      : 'bg-white border-gray-200 text-gray-900'
                  } border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className={`text-sm ${
                    isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                  } underline`}
                >
                  清除日期
                </button>
              )}
            </div>
          )}

          {/* 第三排：搜尋和匯出 */}
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2 flex-1">
              <Search className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <input
                type="text"
                placeholder="Search operations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400'
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                } border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>

            <button
              onClick={exportLogs}
              className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* 操作日誌列表 */}
      <div className={`${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/70 border-gray-100'} rounded-2xl shadow-sm border overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Operation Logs History</h3>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total: {filteredLogs.length} records</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50'}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>Timestamp</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>System</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>Operation</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>Component</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>User</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>Status</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>Command</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>Details</th>
              </tr>
            </thead>
            <tbody className={`${isDarkMode ? 'bg-gray-800/50' : 'bg-white/70'} divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {currentLogs.map((log) => (
                <tr key={log.id} className={isDarkMode ? 'hover:bg-gray-700/50 transition-colors' : 'hover:bg-gray-50 transition-colors'}>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                    {new Date(log.timestamp).toLocaleString('zh-TW')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {log.system === 'SkySails PN14' && <Power className="w-4 h-4 text-blue-500 mr-2" />}
                      {log.system.includes('ESS') && <ToggleLeft className="w-4 h-4 text-green-500 mr-2" />}
                      {log.system.includes('PCS') && <ToggleRight className="w-4 h-4 text-purple-500 mr-2" />}
                      {log.system.includes('Diesel') && <Power className="w-4 h-4 text-orange-500 mr-2" />}
                      {log.system.includes('Air') && <Activity className="w-4 h-4 text-cyan-500 mr-2" />}
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{log.system}</span>
                    </div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>{log.operation}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{log.component}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{log.user}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(log.status)}
                      {getStatusBadge(log.status)}
                    </div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} font-mono`}>
                    {log.command || '-'}
                  </td>
                  <td className={`px-6 py-4 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} max-w-xs truncate`} title={log.details}>
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="text-center py-12">
            <FileText className={`w-12 h-12 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'} mx-auto mb-4`} />
            <p className={isDarkMode ? 'text-gray-500' : 'text-gray-500'}>No logs found matching your criteria</p>
          </div>
        )}

        {/* 分頁控制 */}
        {filteredLogs.length > 0 && (
          <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between`}>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              顯示 {startIndex + 1} - {Math.min(endIndex, filteredLogs.length)} 筆，共 {filteredLogs.length} 筆
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded-lg ${
                  currentPage === 1
                    ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                } transition-colors`}
              >
                首頁
              </button>
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded-lg ${
                  currentPage === 1
                    ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                } transition-colors`}
              >
                上一頁
              </button>
              <span className={`px-4 py-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                第 {currentPage} / {totalPages} 頁
              </span>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-3 py-1 rounded-lg ${
                  currentPage === totalPages
                    ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                } transition-colors`}
              >
                下一頁
              </button>
              <button
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
                className={`px-3 py-1 rounded-lg ${
                  currentPage === totalPages
                    ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                } transition-colors`}
              >
                末頁
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;