import { PublicClientApplication } from 'https://cdnjs.cloudflare.com/ajax/libs/msal-browser/2.28.3/msal-browser.min.js';

const msalConfig = {
  auth: {
    clientId: 'a755bc53-ded3-42e1-9991-74f0d0288d97',
    authority: 'https://login.microsoftonline.com/de0795e0-d7c0-4eeb-b9bb-bc94d8980d3b',
    redirectUri: 'http://localhost:3000',
    knownAuthorities: ['login.microsoftonline.com'],
    protocolMode: 'AAD',
    validateAuthority: true
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        console.log(`MSAL ${level}: ${message}`);
      },
      piiLoggingEnabled: false
    }
  }
};

let msalInstance = new PublicClientApplication(msalConfig);
let isAADConfigFetched = false; // 標誌位，防止多次初始化

async function fetchAADConfig() {
  if (isAADConfigFetched) return; // 如果已經初始化，直接返回

  try {
    const response = await fetch('/aad-config');
    if (!response.ok) {
      throw new Error('Failed to fetch AAD configuration');
    }
    const config = await response.json();
    msalConfig.auth.clientId = config.clientId;
    msalConfig.auth.authority = config.authority;
    msalInstance = new PublicClientApplication(msalConfig);
    isAADConfigFetched = true; // 設置標誌位
  } catch (error) {
    console.error('Error fetching AAD configuration:', error);
  }
}

// 確保 fetchAADConfig 只執行一次
fetchAADConfig();

async function handleLogin() {
  try {
    const loginButton = document.querySelector('button[onclick="handleLogin()"]');
    loginButton.disabled = true; // 防止重複點擊

    const loginResponse = await msalInstance.loginPopup({
      scopes: ['openid', 'profile', 'email']
    });

    if (loginResponse.account) {
      const displayName = loginResponse.account.idTokenClaims?.name || loginResponse.account.username;
      document.getElementById('current-user').textContent = displayName;

      const tokenResponse = await msalInstance.acquireTokenSilent({
        scopes: ['api://bryan_cheng@wistron.com/.default']
      });

      localStorage.setItem('userDisplayName', displayName);
      sessionStorage.setItem('msalAccessToken', tokenResponse.accessToken);

      updateLoginStatus(true); // 更新登錄狀態
    }

    loginButton.disabled = false;
  } catch (error) {
    console.error('Login failed:', error);
    document.getElementById('current-user').textContent = '登錄失敗';

    // 顯示錯誤訊息給用戶
    const responseMessage = document.getElementById('response-message');
    responseMessage.textContent = '登錄失敗: ' + error.message;
    responseMessage.className = 'response-message response-error';
    responseMessage.style.display = 'block';

    setTimeout(() => {
      responseMessage.style.display = 'none';
    }, 5000);
  }
}

function updateLoginStatus(isLoggedIn) {
  const loginButton = document.querySelector('button#login-button');
  if (isLoggedIn) {
    loginButton.textContent = '登出';
    loginButton.onclick = handleLogout;
  } else {
    loginButton.textContent = '登錄';
    loginButton.onclick = handleLogin;
  }
}

async function handleLogout() {
  try {
    await msalInstance.logoutPopup();
    localStorage.removeItem('userDisplayName');
    sessionStorage.removeItem('msalAccessToken');
    document.getElementById('current-user').textContent = '未登錄';
    updateLoginStatus(false); // 更新登出狀態
  } catch (error) {
    console.error('Logout failed:', error);
  }
}

export { handleLogin, handleLogout, msalInstance };