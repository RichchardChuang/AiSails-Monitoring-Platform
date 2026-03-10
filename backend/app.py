# 標準庫
import os
from threading import Thread, Lock
import configparser

# 第三方庫
from flask import Flask, render_template, current_app
import requests

# 本地模組
from utils.config_loader import config, PCS_GAUGE, UPS_SCALES, AC_SCALES, UPS_UNITS, AC_UNITS
from utils.pn14_mapping import PN14_GROUP_NAMES, PN14_FIELD_MAP
from utils.logging_util import add_log, get_logs
from utils.registry import (
    SBMS_REG, SBMS_AC_REG, SBMS_UPS_REG, SBMS_VAL, 
    PCS_REG, PCS_VAL, 
    DIESEL_REG, DIESEL_VAL
)
from routes.status import status_bp
from routes.control import control_bp
from routes.auth import auth_bp
from routes.settings import settings_bp
from services.runtime_service import check_connections, start_mqtt_listener, watch_config
from utils.email_util import get_local_ip, send_email

app = Flask(__name__)

# 讀取配置文件（強制使用 UTF-8-SIG 以避免 cp950 造成的解碼錯誤）
# 停用 % 插值，避免像「濕度(%)」之類的值觸發 InterpolationSyntaxError
# config.cfg 現在放在專案根目錄（與 backend 同層）
# CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config.cfg')
# config = configparser.ConfigParser(interpolation=None)
# config.optionxform = str  # 保留鍵名大小寫，避免群組代碼被轉小寫
# config.read(CONFIG_FILE, encoding='utf-8-sig')

# 建立設備狀態配置
devices = {
    'sbms': {
        'name': 'SBMS',
        'ip': config.get('devices', 'sbms_ip', fallback='127.0.0.1'),
        'port': int(config.get('devices', 'sbms_port', fallback='502')),
        'connected': False
    },
    'pcs': {
        'name': 'PCS',
        'ip': config.get('devices', 'pcs_ip', fallback='127.0.0.1'),
        'port': int(config.get('devices', 'pcs_port', fallback='502')),
        'connected': False
    },
    'diesel': {
        'name': 'DG',
        'ip': config.get('devices', 'diesel_ip', fallback='127.0.0.1'),
        'port': int(config.get('devices', 'diesel_port', fallback='502')),
        'connected': False
    },
    'pn14': {
        'name': 'PN14',
        'host': config.get('Mqtt', 'Host', fallback=''),
        'port': int(config.get('Mqtt', 'Port', fallback='11883')),
        'connected': False,
        'groups': {code: {} for code in PN14_GROUP_NAMES.keys()},
        'last_mqtt': 0.0
    }
}

# 將共享狀態掛載到 app.config
app.config['devices'] = devices
app.config['PCS_GAUGE'] = PCS_GAUGE
app.config['UPS_SCALES'] = UPS_SCALES
app.config['AC_SCALES'] = AC_SCALES
app.config['UPS_UNITS'] = UPS_UNITS
app.config['AC_UNITS'] = AC_UNITS
app.config['PN14_GROUP_NAMES'] = PN14_GROUP_NAMES
app.config['PN14_FIELD_MAP'] = PN14_FIELD_MAP
app.config['mqtt_timeout_sec'] = int(config.get('Mqtt', 'Timeout_Sec', fallback='15'))
app.config['raw_config'] = config

# 註冊 Blueprint
app.register_blueprint(status_bp)
app.register_blueprint(control_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(settings_bp)

# 主頁路由 - 提供 HTML
@app.route('/')
# @app.route('/index.html')
def index():
    """提供主頁 HTML"""
    try:
        return render_template('index.html')
    except Exception as e:
        add_log(f'Error rendering index.html: {str(e)}', level='error')
        return f'<h1>Error loading page</h1><p>{str(e)}</p>', 500

# Logs API endpoint
@app.route('/logs')
def logs():
    """取得系統日誌（最新的在最前面）"""
    all_logs = get_logs()
    return {'ok': True, 'logs': list(reversed(all_logs))}

# 診斷端點 - 用於前端檢查後端狀態
@app.route('/api/diagnostics')
def api_diagnostics():
    """後端診斷端點，回傳系統狀態"""
    current_devices = current_app.config.get('devices', devices)
    return {
        'ok': True,
        'backend_status': 'running',
        'devices': {
            name: {
                'name': dev.get('name'),
                'connected': dev.get('connected'),
                'ip': dev.get('ip') or dev.get('host'),
                'port': dev.get('port')
            }
            for name, dev in current_devices.items()
        },
        'timestamp': __import__('time').time()
    }

# 新增：處理 favicon 請求，若存在 static/favicon.ico 則回傳，否則回傳 204 (No Content)
# @app.route('/favicon.ico')
# def favicon():
#     favicon_path = os.path.join(app.static_folder or '', 'favicon.ico')
#     if os.path.exists(favicon_path):
#         return app.send_static_file('favicon.ico')
#     return ('', 204)

# Weather logging guard: avoid spamming logs when external API temporarily fails
_weather_lock = Lock()
_last_weather_error = None

def _log_weather_once(msg, level='error'):
    """只在錯誤訊息變更時記錄一次，避免重複產生大量相同日誌。"""
    global _last_weather_error
    try:
        with _weather_lock:
            if _last_weather_error != msg:
                add_log(msg, level=level)
                _last_weather_error = msg
    except Exception:
        # 若記錄邏輯意外失敗，仍保證不拋出例外中斷主流程
        try:
            add_log(msg, level=level)
        except Exception:
            pass

# Weather proxy endpoint: 從後端使用配置或環境變數中的 API key 呼叫 OpenWeather，避免在前端暴露 key
@app.route('/weather')
def weather_proxy():
    """代理到 OpenWeather API。使用 config.cfg 中設定的經緯度。"""
    cfg = app.config.get('raw_config')
    # 先從環境變數取得，否則從 config.cfg 的 [weather] 區段取得
    api_key = os.environ.get('OPENWEATHER_API_KEY') or (cfg.get('weather', 'api_key', fallback='') if cfg else '')
    
    if not api_key:
        add_log('天氣 API Key 未設定', level='warning')
        return {
            'ok': False, 
            'error': 'API key not configured',
            'name': '未設定',
            'weather': [{'main': 'Unknown', 'description': '請設定 API Key', 'icon': '01d'}],
            'main': {'temp': 0, 'humidity': 0, 'pressure': 0},
            'wind': {'speed': 0}
        }, 200  # 返回 200 以避免前端錯誤

    # 從 config.cfg 讀取經緯度
    lat = cfg.get('weather', 'lat', fallback='24.0098409') if cfg else '24.0098409'
    lon = cfg.get('weather', 'lon', fallback='120.393036') if cfg else '120.393036'
    
    # 驗證經緯度格式
    try:
        lat_float = float(lat)
        lon_float = float(lon)
        if not (-90 <= lat_float <= 90) or not (-180 <= lon_float <= 180):
            raise ValueError("經緯度超出有效範圍")
    except ValueError as e:
        add_log(f'無效的經緯度: lat={lat}, lon={lon}, 錯誤: {e}', level='error')
        return {
            'ok': False,
            'error': 'Invalid coordinates',
            'name': '座標錯誤',
            'weather': [{'main': 'Unknown', 'description': '無效的座標', 'icon': '01d'}],
            'main': {'temp': 0, 'humidity': 0, 'pressure': 0},
            'wind': {'speed': 0}
        }, 200

    try:
        url = f'https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&lang=zh_tw&units=metric'
        add_log(f'正在查詢天氣 API: lat={lat}, lon={lon}', level='debug')
        
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        
        # 成功時重置錯誤狀態
        try:
            with _weather_lock:
                global _last_weather_error
                _last_weather_error = None
        except Exception:
            pass
        
        result = resp.json()
        add_log(f'天氣資料取得成功: {result.get("name", "Unknown")}, {result.get("main", {}).get("temp", "??")}°C', level='info')
        return result
        
    except requests.exceptions.Timeout:
        _log_weather_once('天氣 API 請求超時', level='error')
        return {
            'ok': False,
            'error': 'timeout',
            'name': '請求超時',
            'weather': [{'main': 'Unknown', 'description': '連線超時', 'icon': '01d'}],
            'main': {'temp': 0, 'humidity': 0, 'pressure': 0},
            'wind': {'speed': 0}
        }, 200
        
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            _log_weather_once('天氣 API Key 無效或已過期', level='error')
            return {
                'ok': False,
                'error': 'invalid_api_key',
                'name': 'API Key 無效',
                'weather': [{'main': 'Unknown', 'description': 'API Key 無效', 'icon': '01d'}],
                'main': {'temp': 0, 'humidity': 0, 'pressure': 0},
                'wind': {'speed': 0}
            }, 200
        else:
            _log_weather_once(f'天氣 API HTTP 錯誤: {e.response.status_code}', level='error')
            return {
                'ok': False,
                'error': f'http_error_{e.response.status_code}',
                'name': '服務錯誤',
                'weather': [{'main': 'Unknown', 'description': 'API 錯誤', 'icon': '01d'}],
                'main': {'temp': 0, 'humidity': 0, 'pressure': 0},
                'wind': {'speed': 0}
            }, 200
            
    except requests.exceptions.ConnectionError:
        _log_weather_once('無法連線至天氣 API 服務', level='error')
        return {
            'ok': False,
            'error': 'connection_error',
            'name': '無法連線',
            'weather': [{'main': 'Unknown', 'description': '無法連線', 'icon': '01d'}],
            'main': {'temp': 0, 'humidity': 0, 'pressure': 0},
            'wind': {'speed': 0}
        }, 200
        
    except Exception as e:
        _log_weather_once(f'天氣 API 發生未預期的錯誤: {str(e)}', level='error')
        return {
            'ok': False,
            'error': str(e),
            'name': '錯誤',
            'weather': [{'main': 'Unknown', 'description': '服務異常', 'icon': '01d'}],
            'main': {'temp': 0, 'humidity': 0, 'pressure': 0},
            'wind': {'speed': 0}
        }, 200

# 啟動背景執行緒（僅在主程序啟動時執行一次）
_threads_started = False

def _send_startup_notification():
    """發送系統啟動通知郵件"""
    try:
        # 檢查是否啟用啟動通知
        cfg = app.config.get('raw_config')
        if cfg and cfg.has_option('settings', 'enable_startup_email'):
            if not cfg.getboolean('settings', 'enable_startup_email', fallback=True):
                add_log('系統啟動通知已停用', level='info')
                return
        
        ip = get_local_ip()
        subject = "系統啟動通知 - 本地IP地址"
        body = f"系統已啟動，本地IP地址為: {ip}"
        send_email('bryan_cheng@wistron.com', subject, body)
        add_log(f'啟動通知郵件已發送至 bryan_cheng@wistron.com (IP: {ip})')
    except Exception as e:
        add_log(f'發送啟動通知郵件失敗: {e}', level='error')

def start_background_threads():
    """啟動所有背景服務執行緒"""
    global _threads_started
    if not _threads_started:
        add_log('正在啟動系統背景服務...')
        # 啟動系統通知
        Thread(target=_send_startup_notification, daemon=True).start()
        # 啟動核心服務
        add_log('啟動設備連線檢查服務...')
        Thread(target=check_connections, args=(devices, app), daemon=True).start()
        add_log('啟動 MQTT 監聽服務...')
        Thread(target=start_mqtt_listener, args=(devices, app), daemon=True).start()
        add_log('啟動配置檔監控服務...')
        Thread(target=watch_config, args=(app, devices), daemon=True).start()
        _threads_started = True
        add_log('系統背景服務啟動完成')
        add_log(f'設備配置: SBMS={devices["sbms"]["ip"]}:{devices["sbms"]["port"]}, '
                f'PCS={devices["pcs"]["ip"]}:{devices["pcs"]["port"]}, '
                f'DG={devices["diesel"]["ip"]}:{devices["diesel"]["port"]}, '
                f'PN14={devices["pn14"]["host"]}:{devices["pn14"]["port"]}')

# 在某些環境下 Flask 物件可能不含 before_first_request，使用 before_request 並靠內部旗標避免重複啟動
@app.before_request
def before_first_request():
    start_background_threads()

if __name__ == '__main__':
    # 開發模式
    start_background_threads()
    add_log('系統啟動完成 (開發模式)')
    app.run(host='0.0.0.0', port=5000, debug=False)