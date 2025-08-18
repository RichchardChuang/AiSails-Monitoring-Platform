// document.addEventListener('DOMContentLoaded', function () {
//             console.log('DOM 已加载完成');
//             // 这里可以写你想要执行的代码
//             alert('DOM Ready!'); // 弹出 "Ready" 的提醒
//         });

// 全域設備清單
const devices = ["sbms", "diesel", "pcs", "pn14"];
let msalInstance;
let alertCount = 0; // 新增警告計數變數

// 取得目前電腦使用者名稱（僅限支援的瀏覽器/環境，否則顯示 Unknown）
function getLocalUserName() {
  if (window.navigator.userAgentData && window.navigator.userAgentData.platform) {
    return window.navigator.userAgentData.platform;
  }
  // 嘗試從環境變數取得（僅限 Electron/Node.js 環境）
  if (window.process && window.process.env && window.process.env.USERNAME) {
    return window.process.env.USERNAME;
  }
  // Edge/IE 專屬 ActiveXObject（僅限 Intranet/IE，現代瀏覽器不支援）
  try {
    // @ts-ignore
    var network = new ActiveXObject('WScript.Network');
    if (network && network.UserName) return network.UserName;
  } catch (e) {}
  // 其他方式皆不可行時
  return "Unknown";
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 從後端獲取 MSAL 配置
    const response = await fetch('/aad-config');
    const { clientId, authority, redirectUri } = await response.json();
    msalInstance = new msal.PublicClientApplication({
      auth: { clientId, authority, redirectUri }
    });
    // 進入網頁時自動啟動 MSAL 登入
    try {
      const loginResponse = await msalInstance.loginPopup({ scopes: ["User.Read"] });
      const account = loginResponse.account;
      document.getElementById('current-user').textContent = account.username || account.name;
      updateLoginStatus(true);
    } catch (error) {
      console.error("Logon failed:", error);
      updateLoginStatus(false, '登入失敗');
    }
  } catch (error) {
    console.error('Cannot fetch AAD configuration:', error);
  }

  // 初始化設備設定表單
  const container = document.getElementById('device-settings-container');
  if (container && container.childElementCount === 0) {
    devices.forEach(device => {
      const deviceDiv = document.createElement('div');
      deviceDiv.innerHTML = `
        <h4>${device.toUpperCase()}</h4>
        <label for="${device}-ip">IP:</label>
        <input type="text" id="${device}-ip" name="${device}-ip" placeholder="input IP address">
        <label for="${device}-port">Port:</label>
        <input type="number" id="${device}-port" name="${device}-port" placeholder="input Port">
      `;
      container.appendChild(deviceDiv);
    });
  }

  // 從後端API獲取設備配置
  try {
    const response = await fetch('/load-config');
    const config = await response.json();
    document.getElementById('overview-ip').value = config.overview?.overview_ip || '';
    devices.forEach(device => {
      document.getElementById(`${device}-ip`).value = config.devices?.[`${device}_ip`] || '';
      document.getElementById(`${device}-port`).value = config.devices?.[`${device}_port`] || '';
    });
  } catch (error) {
    console.error('無法載入設備配置:', error);
  }

  // 頁面切換初始化
  document.querySelectorAll('section').forEach(section => {
    section.style.display = 'none';
  });
  document.getElementById('overview').style.display = 'block';
  resizeOverviewIframe();
  updateWeatherInfo();
  fetchDeviceStatus();
  setInterval(fetchDeviceStatus, 6000); // 每秒鐘自動刷新設備狀態

  // 設定目前電腦使用者帳號名
  document.getElementById('current-user').textContent = getLocalUserName();
});

function updateLoginStatus(isLoggedIn, errorMsg = '') {
  const loginButton = document.getElementById('login-button');
  const currentUser = document.getElementById('current-user');
  if (isLoggedIn) {
    loginButton.textContent = "Logout";
    loginButton.onclick = handleLogout;
    currentUser.style.color = '#1976d2';
    currentUser.textContent = currentUser.textContent || '已登入';
  } else {
    loginButton.textContent = "logon";
    loginButton.onclick = handleLogin;
    currentUser.style.color = '#F14C4C';
    currentUser.textContent = errorMsg ? errorMsg : '未登入';
  }
}

async function handleLogin() {
  const loginButton = document.getElementById('login-button');
  loginButton.disabled = true;
  loginButton.style.cursor = 'wait';
  try {
    const loginResponse = await msalInstance.loginPopup({ scopes: ["User.Read"] });
    const account = loginResponse.account;
    document.getElementById('current-user').textContent = account.username || account.name;
    updateLoginStatus(true);
  } catch (error) {
    console.error("Logon failed:", error);
    updateLoginStatus(false, '登入失敗');
    alert("Logon failed, please try again!");
  } finally {
    loginButton.disabled = false;
    loginButton.style.cursor = 'pointer';
  }
}

async function handleLogout() {
  const loginButton = document.getElementById('login-button');
  loginButton.disabled = true;
  loginButton.style.cursor = 'wait';
  try {
    await msalInstance.logoutPopup();
    document.getElementById('current-user').textContent = 'Logged out';
    updateLoginStatus(false);
  } catch (error) {
    console.error("Logout failed:", error);
    updateLoginStatus(false, '登出失敗');
    alert("Log out failed, please try again!");
  } finally {
    loginButton.disabled = false;
    loginButton.style.cursor = 'pointer';
  }
}

function navigateTo(page) {
  document.querySelectorAll('section').forEach(section => {
    section.style.display = 'none';
  });
  document.getElementById(page).style.display = 'block';
  document.querySelectorAll('.nav-button').forEach(button => {
    button.classList.remove('active');
  });
  // 根據 page 名稱高亮對應按鈕
  const navMap = {
    'overview': '系統狀況',
    'device-control': '設備控制',
    'alerts': '系統告警',
    'settings': '參數設定',
    'help': '幫助'
  };
  const activeButton = Array.from(document.querySelectorAll('.nav-button')).find(button => button.textContent.includes(navMap[page]));
  if (activeButton) activeButton.classList.add('active');
}

function resizeOverviewIframe() {
  const nav = document.querySelector('nav');
  const infoBar = document.querySelector('.info-bar');
  const iframe = document.getElementById('overview-iframe');
  const navHeight = nav ? nav.offsetHeight : 0;
  const infoBarHeight = infoBar ? infoBar.offsetHeight : 0;
  const availableHeight = window.innerHeight - navHeight - infoBarHeight;
  if (iframe) iframe.style.height = availableHeight + 'px';
}
window.addEventListener('resize', resizeOverviewIframe);

async function updateWeatherInfo() {
  try {
    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=4387509096865c786643f2bcd88e4160&lang=zh_tw&units=metric`);
      const data = await response.json();
      const locationName = data.name || '';
      const weatherDescription = data.weather[0].description;
      const temperature = data.main.temp;
      const windSpeed = data.wind.speed;
      const windDeg = data.wind.deg;
      const icon = data.weather[0].icon;
      // 風向中文
      let windDir = '--';
      if (typeof windDeg === 'number') {
        const dirs = ['北', '北北東', '東北', '東北東', '東', '東南東', '東南', '南南東', '南', '南南西', '西南', '西南西', '西', '西北西', '西北', '北北西', '北'];
        windDir = dirs[Math.round(windDeg / 22.5) % 16];
      }
      // 簡化天氣資訊顯示在訊息列中，使用 span 元素分隔各部分
      document.getElementById('weather-block').innerHTML =
        `<img src="https://openweathermap.org/img/wn/${icon}.png" alt="天氣圖標"/>
         <span>${locationName ? locationName : '未知地點'}</span>
         <span>${weatherDescription}</span>
         <span>${temperature.toFixed(1)}°C</span>
         <span>風速: ${windSpeed}m/s</span>
         <i class="fa fa-arrow-up" style="transform: rotate(${windDeg}deg); margin: 0 30px;"></i>`;
    }, (error) => {
      document.getElementById('weather-block').textContent = '無法取得天氣';
    });
  } catch (error) {
    document.getElementById('weather-block').textContent = '天氣載入失敗';
  }
}
setInterval(updateWeatherInfo, 300000);

const API_BASE = "/control";
const STATUS_API = "/status";

async function fetchDeviceStatus() {
  try {
    const response = await fetch(STATUS_API);
    const data = await response.json();
    updateDeviceStatus(data.devices);
  } catch (error) {
    console.error("Failed to fetch device status:", error);
  }
}

function updateDeviceStatus(devicesStatus) {
  for (const [key, device] of Object.entries(devicesStatus)) {
    const card = document.getElementById(`device-${key}`);
    if (!card) continue;
    const buttons = card.querySelectorAll("button");
    const name = card.querySelector("h3");
    if (device.connected) {
      name.style.color = "#007ACC";
      buttons.forEach(button => {
        button.disabled = false;
        button.classList.remove("disabled");
        button.style.cursor = "pointer";
      });
    } else {
      name.style.color = "#F14C4C";
      buttons.forEach(button => {
        button.disabled = true;
        button.classList.add("disabled");
        button.style.cursor = "not-allowed";
      });
    }
  }

  // SBMS 設備訊息
  document.getElementById('sbms-voltage').textContent = devicesStatus.sbms?.voltage ?? '--';
  document.getElementById('sbms-current').textContent = devicesStatus.sbms?.current ?? '--';
  document.getElementById('sbms-temp').textContent = devicesStatus.sbms?.temperature ?? '--';
  document.getElementById('sbms-status').textContent = devicesStatus.sbms?.active ? 'Active' : 'Inactive';
  document.getElementById('battery-level').textContent = `${devicesStatus.sbms?.soc ?? '--'}%`;
  
  // 如果有UPS和空調的元素，也更新它們
  if (document.getElementById('ups-status')) {
    document.getElementById('ups-status').textContent = 'Normal';
    document.getElementById('ups-voltage').textContent = devicesStatus.sbms?.voltage ?? '--';
    document.getElementById('ups-load').textContent = '50';
  }
  
  if (document.getElementById('ac-status')) {
    document.getElementById('ac-status').textContent = 'Running';
    document.getElementById('ac-temp').textContent = '25';
    document.getElementById('ac-mode').textContent = 'Cooling';
  }

  // 頻率顯示到小數點第二位
  let freq = devicesStatus.pcs?.frequency;
  document.getElementById('pcs-frequency').textContent = (typeof freq === 'number' ? freq.toFixed(2) : '--');

  // 控制頻率調整按鈕啟用/禁用
  const freqDownBtn = document.getElementById('pcs-freq-down');
  const freqUpBtn = document.getElementById('pcs-freq-up');
  if (devicesStatus.pcs?.connected) {
    // 連線時才根據頻率啟用/禁用
    if (typeof freq === 'number') {
      if (freq <= 59.77) {
        freqDownBtn.disabled = true;
        freqDownBtn.classList.add('disabled');
        freqDownBtn.style.cursor = "not-allowed";
      } else {
        freqDownBtn.disabled = false;
        freqDownBtn.classList.remove('disabled');
        freqDownBtn.style.cursor = "pointer";
      }
      if (freq >= 60.00) {
        freqUpBtn.disabled = true;
        freqUpBtn.classList.add('disabled');
        freqUpBtn.style.cursor = "not-allowed";
      } else {
        freqUpBtn.disabled = false;
        freqUpBtn.classList.remove('disabled');
        freqUpBtn.style.cursor = "pointer";
      }
    }
  } else {
    // 未連線時全部禁用
    freqDownBtn.disabled = true;
    freqDownBtn.classList.add('disabled');
    freqDownBtn.style.cursor = "not-allowed";
    freqUpBtn.disabled = true;
    freqUpBtn.classList.add('disabled');
    freqUpBtn.style.cursor = "not-allowed";
  }

  // Diesel 設備訊息 - 更新所有柴油發電機相關數據
  document.getElementById('diesel-power').textContent = devicesStatus.diesel?.power ?? '--';
  document.getElementById('diesel-fuel').textContent = devicesStatus.diesel?.fuel ?? '--';
  document.getElementById('diesel-temp').textContent = devicesStatus.diesel?.temperature ?? '--';
  document.getElementById('diesel-status').textContent = devicesStatus.diesel?.status ?? '--';
  
  // 更新柴油發電機子卡片的詳細信息
  if (document.getElementById('diesel-frequency')) {
    document.getElementById('diesel-frequency').textContent = devicesStatus.diesel?.frequency ?? '--';
  }
  if (document.getElementById('diesel-oilpressure')) {
    document.getElementById('diesel-oilpressure').textContent = devicesStatus.diesel?.oilpressure ?? '--';
  }
  if (document.getElementById('diesel-coolertemperature')) {
    document.getElementById('diesel-coolertemperature').textContent = devicesStatus.diesel?.coolertemperature ?? '--';
  }
  if (document.getElementById('diesel-l1power')) {
    document.getElementById('diesel-l1power').textContent = devicesStatus.diesel?.l1power ?? '--';
  }
  if (document.getElementById('diesel-l2power')) {
    document.getElementById('diesel-l2power').textContent = devicesStatus.diesel?.l2power ?? '--';
  }
  if (document.getElementById('diesel-l3power')) {
    document.getElementById('diesel-l3power').textContent = devicesStatus.diesel?.l3power ?? '--';
  }
  if (document.getElementById('diesel-l1voltage')) {
    document.getElementById('diesel-l1voltage').textContent = devicesStatus.diesel?.l1l2voltage ?? '--';
  }
  if (document.getElementById('diesel-l2voltage')) {
    document.getElementById('diesel-l2voltage').textContent = devicesStatus.diesel?.l2l3voltage ?? '--';
  }
  if (document.getElementById('diesel-l3voltage')) {
    document.getElementById('diesel-l3voltage').textContent = devicesStatus.diesel?.l3l1voltage ?? '--';
  }
  if (document.getElementById('diesel-l1current')) {
    document.getElementById('diesel-l1current').textContent = devicesStatus.diesel?.l1current ?? '--';
  }
  if (document.getElementById('diesel-l2current')) {
    document.getElementById('diesel-l2current').textContent = devicesStatus.diesel?.l2current ?? '--';
  }
  if (document.getElementById('diesel-l3current')) {
    document.getElementById('diesel-l3current').textContent = devicesStatus.diesel?.l3current ?? '--';
  }
  if (document.getElementById('diesel-batteryvoltage')) {
    document.getElementById('diesel-batteryvoltage').textContent = devicesStatus.diesel?.batteryvoltage ?? '--';
  }
  if (document.getElementById('diesel-chargemagneticvoltage')) {
    document.getElementById('diesel-chargemagneticvoltage').textContent = devicesStatus.diesel?.chargemagneticvoltage ?? '--';
  }
  // PCS 資訊顯示
  document.getElementById('pcs-voltage').textContent = devicesStatus.pcs?.dcvoltage ?? '--';
  document.getElementById('pcs-current').textContent = devicesStatus.pcs?.current ?? '--';
  document.getElementById('pcs-status').textContent = devicesStatus.pcs?.pcsstatus ?? '--';
  document.getElementById('pcs-activepower').textContent = devicesStatus.pcs?.power ?? '--';
  document.getElementById('pcs-reactivepower').textContent = devicesStatus.pcs?.reactivepower ?? '--';
  document.getElementById('pcs-load').textContent = devicesStatus.pcs?.load ?? '--';
  document.getElementById('pcs-temp').textContent = devicesStatus.pcs?.temperature ?? '--';
  document.getElementById('pcs-connected').textContent = devicesStatus.pcs?.connected ? '連線' : '離線';
  document.getElementById('pcs-operationmode').textContent = devicesStatus.pcs?.operationmode ?? '--';
  document.getElementById('pcs-pcsstatus').textContent = devicesStatus.pcs?.pcsstatus ?? '--';
  document.getElementById('pcs-gridstatus').textContent = devicesStatus.pcs?.gridstatus ?? '--';
  document.getElementById('pcs-supplyfrequency').textContent = devicesStatus.pcs?.supplyfrequency ?? '--';
  document.getElementById('pcs-dcvoltage').textContent = devicesStatus.pcs?.dcvoltage ?? '--';
  document.getElementById('pcs-fault').textContent = devicesStatus.pcs?.fault ?? '--';
  document.getElementById('pcs-linevoltage').textContent = devicesStatus.pcs?.linevoltage ?? '--';
  document.getElementById('pcs-linefrequency').textContent = devicesStatus.pcs?.linefrequency ?? '--';

  // PN14 設備訊息
  document.getElementById('pn14-wind').textContent = devicesStatus.pn14?.wind ?? '--';
  document.getElementById('pn14-force').textContent = devicesStatus.pn14?.force ?? '--';
  document.getElementById('pn14-status').textContent = devicesStatus.pn14?.status ?? '--';

  // 網路狀態顯示 global_status，並依狀態顯示燈號與文字
  const networkStatusText = document.getElementById('network-status');
  const networkIndicator = document.getElementById('network-status-indicator');
  if (devicesStatus?.global_status)  {
    networkIndicator.style.background = '#52c41a'; // 綠色
    networkStatusText.textContent = 'Good';
   } else {
    networkIndicator.style.background = '#ffc107'; // 黃色
    networkStatusText.textContent = 'Not Good';
  }

  // 更新設備連接狀態圖標
  // SBMS
  if (devicesStatus.sbms?.connected) {
    document.getElementById('sbms-status-icon').style.display = '';
    document.getElementById('sbms-disconnect-icon').style.display = 'none';
  } else {
    document.getElementById('sbms-status-icon').style.display = 'none';
    document.getElementById('sbms-disconnect-icon').style.display = '';
  }
  // Diesel
  if (devicesStatus.diesel?.connected) {
    document.getElementById('diesel-status-icon').style.display = '';
    document.getElementById('diesel-disconnect-icon').style.display = 'none';
  } else {
    document.getElementById('diesel-status-icon').style.display = 'none';
    document.getElementById('diesel-disconnect-icon').style.display = '';
  }
  // PN14
  if (devicesStatus.pn14?.connected) {
    document.getElementById('pn14-status-icon').style.display = '';
    document.getElementById('pn14-disconnect-icon').style.display = 'none';
  } else {
    document.getElementById('pn14-status-icon').style.display = 'none';
    document.getElementById('pn14-disconnect-icon').style.display = '';
  }

  }

async function sendCommand(device, action) {
  const responseMessage = document.getElementById("response-message");
  const buttons = document.querySelectorAll("button");
  // 禁用所有按鈕，顯示 loading 狀態
  buttons.forEach(button => {
    button.disabled = true;
    button.style.cursor = "wait";
  });
  responseMessage.textContent = '執行中...';
  responseMessage.className = "response-message";
  responseMessage.style.display = "block";
  // 添加時間戳記
  const timestamp = new Date().toLocaleTimeString();
  const commandMessage = `[${timestamp}] 執行命令: ${device} ${action}`;
  
  // 將命令添加到執行紀錄中
  const logDiv = document.getElementById("log-messages");
  if (logDiv) {
    const newLogEntry = document.createElement("div");
    newLogEntry.textContent = commandMessage;
    newLogEntry.style.borderBottom = "1px solid #e0eaf2";
    newLogEntry.style.paddingBottom = "6px";
    newLogEntry.style.marginBottom = "6px";
    logDiv.insertBefore(newLogEntry, logDiv.firstChild);
  }
  
  try {
    const response = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device, action })
    });
    const result = await response.json();
    if (response.ok) {
      responseMessage.textContent = result.message || "Successful";
      responseMessage.className = "response-message response-success";
      
      // 將成功結果添加到執行紀錄中
      if (logDiv) {
        const resultLogEntry = document.createElement("div");
        resultLogEntry.textContent = `[${new Date().toLocaleTimeString()}] 執行結果: ${result.message || "成功"}`;
        resultLogEntry.style.color = "#52c41a";
        resultLogEntry.style.borderBottom = "1px solid #e0eaf2";
        resultLogEntry.style.paddingBottom = "6px";
        resultLogEntry.style.marginBottom = "6px";
        logDiv.insertBefore(resultLogEntry, logDiv.firstChild);
      }
    } else {
      responseMessage.textContent = result.error || "Failed";
      responseMessage.className = "response-message response-error";
      
      // 將失敗結果添加到執行紀錄中
      if (logDiv) {
        const errorLogEntry = document.createElement("div");
        errorLogEntry.textContent = `[${new Date().toLocaleTimeString()}] 執行失敗: ${result.error || "未知錯誤"}`;
        errorLogEntry.style.color = "#F14C4C";
        errorLogEntry.style.borderBottom = "1px solid #e0eaf2";
        errorLogEntry.style.paddingBottom = "6px";
        errorLogEntry.style.marginBottom = "6px";
        logDiv.insertBefore(errorLogEntry, logDiv.firstChild);
      }
    }
  } catch (error) {
    responseMessage.textContent = "Unable to connect to the backend service";
    responseMessage.className = "response-message response-error";
    console.error("Error sending command:", error);
    
    // 將連接錯誤添加到執行紀錄中
    if (logDiv) {
      const connectionErrorEntry = document.createElement("div");
      connectionErrorEntry.textContent = `[${new Date().toLocaleTimeString()}] 連接錯誤: 無法連接到後端服務`;
      connectionErrorEntry.style.color = "#F14C4C";
      connectionErrorEntry.style.borderBottom = "1px solid #e0eaf2";
      connectionErrorEntry.style.paddingBottom = "6px";
      connectionErrorEntry.style.marginBottom = "6px";
      logDiv.insertBefore(connectionErrorEntry, logDiv.firstChild);
    }
  } finally {
    // 完全執行完畢後才啟用所有按鈕
    buttons.forEach(button => {
      button.disabled = false;
      button.style.cursor = "pointer";
    });
  }
  responseMessage.style.display = "block";
  setTimeout(() => {
    responseMessage.style.display = "none";
  }, 5000);
}

async function saveSettings() {
  const saveBtn = document.getElementById('save-settings-btn');
  saveBtn.disabled = true;
  saveBtn.style.cursor = 'wait';
  saveBtn.textContent = '儲存中...';
  const formData = new FormData(document.getElementById('settings-form'));
  // 構造正確格式
  const config = {
    overview: {
      overview_ip: formData.get('overview-ip')
    },
    devices: {}
  };
  devices.forEach(device => {
    config.devices[`${device}_ip`] = formData.get(`${device}-ip`);
    config.devices[`${device}_port`] = formData.get(`${device}-port`);
  });
  try {
    const response = await fetch('/save-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (response.ok) {
      alert('Settings saved successfully!');
    } else {
      alert('Settings failed to save!');
    }
  } catch (error) {
    console.error('Error occurred while saving settings:', error);
    alert('An error occurred while saving settings!');
  } finally {
    saveBtn.disabled = false;
    saveBtn.style.cursor = 'pointer';
    saveBtn.innerHTML = '<i class="fa fa-save" style="margin-right:8px;"></i>SAVE';
  }
}

// 取得執行紀錄log並顯示於alerts頁
async function fetchLogs() {
  try {
    const response = await fetch('/logs');
    const logs = await response.json();
    const logDiv = document.getElementById('log-messages');
    if (logDiv) {
      logDiv.innerHTML = logs.map(msg => `<div style="padding: 8px 0; border-bottom: 1px solid #e0eaf2;">${msg}</div>`).join('');
      logDiv.scrollTop = 0; // 滾動到頂部，顯示最新日誌
    }
  } catch (e) {
    console.error('Error fetching logs:', e);
  }
}
setInterval(fetchLogs, 3000);
document.addEventListener('DOMContentLoaded', fetchLogs);






//  ************設定設備設定區塊的label與input樣式*****************
      document.addEventListener('DOMContentLoaded', () => {
        const container = document.getElementById('device-settings-container');
        if (container) {
          Array.from(container.querySelectorAll('label')).forEach(label => {
            label.style.fontWeight = 'bold';
            label.style.fontSize = '1.2em';
          });
          Array.from(container.querySelectorAll('input')).forEach(input => {
            input.style.backgroundColor = '#E5E9F2';
            input.style.color = '#003366';
            input.style.fontSize = '1.2em';
          });
        }
      });

//  ************existing code*****************

function toggleDieselSwitchCmd() {
  const sw = document.getElementById('diesel-toggle-switch');
  // 不再切換文字，I/O 由 CSS 控制
  if (sw.checked) {
    sendCommand('diesel', 'start_dg');
  } else {
    sendCommand('diesel', 'stop_dg');
  }
}