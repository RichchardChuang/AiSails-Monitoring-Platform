from flask import Flask, jsonify, request, render_template
import modbus_tk.defines as cst
from modbus_tk import modbus_tcp,hooks
import configparser
from threading import Lock, Thread
import logging,time
from modbus_tk.utils import create_logger   
from types import SimpleNamespace
import os
from collections import deque
import threading
from typing import Optional
import json
try:
    import paho.mqtt.client as mqtt
except Exception:
    mqtt = None
    # 將在啟動時記錄警告

app = Flask(__name__)

# 讀取配置文件（強制使用 UTF-8-SIG 以避免 cp950 造成的解碼錯誤）
# 停用 % 插值，避免像「濕度(%)」之類的值觸發 InterpolationSyntaxError
config = configparser.ConfigParser(interpolation=None)
config.optionxform = str  # 保留鍵名大小寫，避免群組代碼被轉小寫
config.read('config.cfg', encoding='utf-8-sig')

# ---- 比例尺與單位設定解析 ----
def _load_scale(section: str):
    if not config.has_section(section):
        return {}
    scales = {}
    for k, spec in config.items(section):
        try:
            parts = [p.strip() for p in str(spec).split(',')]
            scale = float(parts[0]) if parts and parts[0] else 1.0
            bias = float(parts[1]) if len(parts) > 1 and parts[1] else 0.0
            scales[k] = (scale, bias)
        except Exception:
            continue
    return scales

def _load_unit(section: str):
    if not config.has_section(section):
        return {}
    return {k: v for k, v in config.items(section)}

# 新增：讀取 PCS 儀表板參數（若未設置則使用預設）
def _load_pcs_gauge():
    defaults = {
        'min': 59.77,
        'max': 60.23,
        'target': 60.00,
        'zone_low': 59.90,
        'zone_high': 60.02,
    }
    section = 'pcs.gauge'
    if not config.has_section(section):
        return defaults
    out = {}
    for k, v in defaults.items():
        try:
            out[k] = float(config.get(section, k, fallback=str(v)))
        except Exception:
            out[k] = v
    return out

UPS_SCALES = _load_scale('sbms.ups.scale')
AC_SCALES  = _load_scale('sbms.ac.scale')
UPS_UNITS  = _load_unit('sbms.ups.unit')
AC_UNITS   = _load_unit('sbms.ac.unit')
PCS_GAUGE  = _load_pcs_gauge()

# 監看設定檔相關
CONFIG_PATH = 'config.cfg'
CONFIG_MTIME = 0.0

def _reload_scales_units_and_registers():
    global UPS_SCALES, AC_SCALES, UPS_UNITS, AC_UNITS, PCS_GAUGE
    UPS_SCALES = _load_scale('sbms.ups.scale')
    AC_SCALES  = _load_scale('sbms.ac.scale')
    UPS_UNITS  = _load_unit('sbms.ups.unit')
    AC_UNITS   = _load_unit('sbms.ac.unit')
    PCS_GAUGE  = _load_pcs_gauge()
    # 重新載入 AC/UPS 暫存器位址（若有變更）
    try:
        setattr(SBMS_AC_REG, 'ac_cooling',     cfg_int('sbms.registers','ac_cooling',     getattr(SBMS_AC_REG, 'ac_cooling', -1)))
        setattr(SBMS_AC_REG, 'ac_heating',     cfg_int('sbms.registers','ac_heating',     getattr(SBMS_AC_REG, 'ac_heating', -1)))
        setattr(SBMS_AC_REG, 'ac_temperature', cfg_int('sbms.registers','ac_temperature', getattr(SBMS_AC_REG, 'ac_temperature', -1)))
        setattr(SBMS_AC_REG, 'ac_humidity',    cfg_int('sbms.registers','ac_humidity',    getattr(SBMS_AC_REG, 'ac_humidity', -1)))
        setattr(SBMS_UPS_REG, 'upsoutcurrent',     cfg_int('sbms.registers','upsoutcurrent',     getattr(SBMS_UPS_REG, 'upsoutcurrent', -1)))
        setattr(SBMS_UPS_REG, 'upsoutvoltage',     cfg_int('sbms.registers','upsoutvoltage',     getattr(SBMS_UPS_REG, 'upsoutvoltage', -1)))
        setattr(SBMS_UPS_REG, 'upsoutpower',       cfg_int('sbms.registers','upsoutpower',       getattr(SBMS_UPS_REG, 'upsoutpower', -1)))
        setattr(SBMS_UPS_REG, 'upsinvoltage',      cfg_int('sbms.registers','upsinvoltage',      getattr(SBMS_UPS_REG, 'upsinvoltage', -1)))
        setattr(SBMS_UPS_REG, 'upscapacity',       cfg_int('sbms.registers','upscapacity',       getattr(SBMS_UPS_REG, 'upscapacity', -1)))
        setattr(SBMS_UPS_REG, 'upsloadpercent',    cfg_int('sbms.registers','upsloadpercent',    getattr(SBMS_UPS_REG, 'upsloadpercent', -1)))
        setattr(SBMS_UPS_REG, 'upsbatteryvoltage', cfg_int('sbms.registers','upsbatteryvoltage', getattr(SBMS_UPS_REG, 'upsbatteryvoltage', -1)))
    except Exception:
        pass

def watch_config():
    global CONFIG_MTIME
    while True:
        try:
            mtime = os.path.getmtime(CONFIG_PATH)
            if CONFIG_MTIME == 0.0:
                CONFIG_MTIME = mtime
            elif mtime > CONFIG_MTIME:
                with lock:
                    # 重新讀取設定檔，更新比例尺/單位與暫存器位址
                    config.read(CONFIG_PATH, encoding='utf-8-sig')
                    _reload_scales_units_and_registers()
                    # 新增：連同 PN14 群組/Topic 映射一併熱載入
                    _reload_pn14_mappings()
                    add_log('配置已熱載入（比例尺/單位/AC-UPS/PCS儀表/PN14群組與映射）')
                CONFIG_MTIME = mtime
        except Exception as e:
            try:
                logger.error(f"監看設定檔失敗: {e}")
            except Exception:
                pass
        time.sleep(2)

# ---- PN14 設定映射載入 ----

def _pn14_group_names():
    """讀取 [pn14.groups] 或 [PN14.groups]（大小寫不敏感）中的群組代碼與顯示名稱。"""
    names = {}
    try:
        # 允許大小寫任意：逐一比對 section.lower()
        for section in config.sections():
            if section.lower() == 'pn14.groups':
                for code, label in config.items(section):
                    names[code] = label
                break
    except Exception:
        pass
    return names

# 將群組代碼做歸一化（移除非英數字元，統一大小寫）
def _normalize_group_code(s: str) -> str:
    return ''.join(ch for ch in (s or '') if ch.isalnum()).lower()

# 建立歸一化 -> 正規鍵 的對照，正規鍵來自 [pn14.groups] 的鍵名
PN14_GROUP_NAMES = _pn14_group_names()
PN14_GROUP_CANON = { _normalize_group_code(k): k for k in PN14_GROUP_NAMES.keys() }

# 由多個 [PN14.topics.<Group>] 區段建立 JSON 欄位對應到群組/顯示名
# e.g. [PN14.topics.WeatherStation]\n temperature = WsAirTemperatureGround_degC
# 結果：{'wsairtemperatureground_degc': ('WeatherStation','temperature')}
def _pn14_build_field_map_from_sections():
    """從 [PN14.topics.*] 或 [pn14.topics.*] 各區段建立：來源欄位(lower) -> (群組代碼, 顯示標籤)
    例如：
      [PN14.topics.WeatherStation]
      temperature = WsAirTemperatureGround_degC
    會生成：{"wsairtemperatureground_degc": ("WeatherStation", "temperature")}。
    僅當群組代碼存在於 [pn14.groups] 定義時才建立對應，避免產生幽靈群組。
    """
    fmap = {}
    try:
        for section in config.sections():
            if section.lower().startswith('pn14.topics.'):
                # 後綴為群組代碼（可能與 [pn14.groups] 大小寫不同，因此要正規化後還原）
                grp_suffix = section.split('.', 2)[-1]
                canon = PN14_GROUP_CANON.get(_normalize_group_code(grp_suffix))
                if not canon:
                    # 未在群組清單中的群組略過
                    continue
                for label, source in config.items(section):
                    src_key = str(source).strip().lower()
                    if not src_key:
                        continue
                    fmap[src_key] = (canon, label)
    except Exception:
        pass
    return fmap

# 初始化：允許後續以 _reload_pn14_mappings() 覆寫
PN14_FIELD_MAP = {}

def _reload_pn14_mappings():
    """重建 PN14 群組顯示名稱、正規化映射與欄位來源映射，並更新 devices['pn14'].groups。"""
    global PN14_GROUP_NAMES, PN14_GROUP_CANON, PN14_FIELD_MAP
    PN14_GROUP_NAMES = _pn14_group_names()
    PN14_GROUP_CANON = { _normalize_group_code(k): k for k in PN14_GROUP_NAMES.keys() }
    PN14_FIELD_MAP = _pn14_build_field_map_from_sections()
    # 同步 devices 中的群組結構（保留既有資料）
    try:
        pn = devices.get('pn14')
        if isinstance(pn, dict):
            old = pn.get('groups') or {}
            new_groups = { code: (old.get(code, {}) if isinstance(old, dict) else {}) for code in PN14_GROUP_NAMES.keys() }
            pn['groups'] = new_groups
            devices['pn14'] = pn
    except Exception:
        pass

# 模組載入時先建一次映射
_reload_pn14_mappings()

# -------- 寄存器/值映射：由 config.cfg 駆動 --------
def cfg_int(section: str, key: str, default: int) -> int:
    try:
        return int(config.get(section, key, fallback=str(default)))
    except Exception:
        return default

SBMS_REG = SimpleNamespace(
    unit=cfg_int('sbms.registers','unit_id',1),
    clear_fault=cfg_int('sbms.registers','clear_fault',501),
    power_cmd=cfg_int('sbms.registers','power_cmd',503),
    precharge=cfg_int('sbms.registers','precharge',8),
    dc_switch=cfg_int('sbms.registers','dc_switch',5)
)
# 新增：SBMS 內的 UPS/AC 監控暫存器位址（若未設定則為 -1 表示略過）
SBMS_AC_REG = SimpleNamespace(
    ac_cooling=cfg_int('sbms.registers','ac_cooling', -1),
    ac_heating=cfg_int('sbms.registers','ac_heating', -1),
    ac_temperature=cfg_int('sbms.registers','ac_temperature', -1),
    ac_humidity=cfg_int('sbms.registers','ac_humidity', -1)
)
# 新增：UPS 監控暫存器位址（未設定則為 -1 表示略過）
SBMS_UPS_REG = SimpleNamespace(
    upsoutcurrent=cfg_int('sbms.registers','upsoutcurrent', -1),
    upsoutvoltage=cfg_int('sbms.registers','upsoutvoltage', -1),
    upsoutpower=cfg_int('sbms.registers','upsoutpower', -1),
    upsinvoltage=cfg_int('sbms.registers','upsinvoltage', -1),
    upscapacity=cfg_int('sbms.registers','upscapacity', -1),
    upsloadpercent=cfg_int('sbms.registers','upsloadpercent', -1),
    upsbatteryvoltage=cfg_int('sbms.registers','upsbatteryvoltage', -1)
)
SBMS_VAL = SimpleNamespace(
    dc_open=cfg_int('sbms.values','dc_open',1),
    dc_close=cfg_int('sbms.values','dc_close',2),
    precharge_close_cmd=cfg_int('sbms.values','precharge_close_cmd',7),
    precharge_status=cfg_int('sbms.values','precharge_status',7)
)
PCS_REG = SimpleNamespace(
    unit=cfg_int('pcs.registers','unit_id',1),
    control=cfg_int('pcs.registers','control',2000),
    freq_ctrl=cfg_int('pcs.registers','freq_ctrl',2003),
    summary_start=cfg_int('pcs.registers','summary_start',2101),
    summary_len=cfg_int('pcs.registers','summary_len',12)
)
PCS_VAL = SimpleNamespace(
    cmd_stop=cfg_int('pcs.values','cmd_stop',1024),
    cmd_run=cfg_int('pcs.values','cmd_run',1033),
    cmd_fault_reset_on=cfg_int('pcs.values','cmd_fault_reset_on',128),
    cmd_fault_reset_off=cfg_int('pcs.values','cmd_fault_reset_off',0),
    freq_down=cfg_int('pcs.values','freq_down',16),
    freq_up=cfg_int('pcs.values','freq_up',32)
)
DIESEL_REG = SimpleNamespace(
    unit=cfg_int('diesel.registers','unit_id',1),
    start_stop=cfg_int('diesel.registers','start_stop',7),
    acb=cfg_int('diesel.registers','acb',6),
    status_start=cfg_int('diesel.registers','status_start',100),
    status_len=cfg_int('diesel.registers','status_len',16)
)
DIESEL_VAL = SimpleNamespace(
    start=cfg_int('diesel.values','start',1),
    stop=cfg_int('diesel.values','stop',2),
    acb_close=cfg_int('diesel.values','acb_close',4),
    acb_open=cfg_int('diesel.values','acb_open',8),
    status_bit_started=cfg_int('diesel.values','status_bit_started',1),
    status_bit_manual=cfg_int('diesel.values','status_bit_manual',8),
    status_bit_acb_on=cfg_int('diesel.values','status_bit_acb_on',32)
)

# -------- Modbus 安全讀寫（含 verify 與 rollback） --------
def mb_read(master, unit_id: int, func: int, addr: int, count: int, retries: int | None = None, interval: float | None = None):
    if retries is None:
        retries = RETRY_CONNECT
    if interval is None:
        interval = RETRY_INTERVAL
    last_err = None
    for _ in range(retries):
        try:
            return master.execute(unit_id, func, addr, count)
        except Exception as e:
            last_err = e
            time.sleep(interval)
    raise last_err or Exception("mb_read failed")

def mb_read1(master, unit_id: int, addr: int) -> int:
    return mb_read(master, unit_id, cst.READ_HOLDING_REGISTERS, addr, 1)[0]

def mb_write_reg(master, unit_id: int, addr: int, value: int, *, verify: bool = False, rollback: bool = False, retries: int | None = None, interval: float | None = None):
    if retries is None:
        retries = RETRY_CONNECT
    if interval is None:
        interval = RETRY_INTERVAL
    last_err = None
    orig = None
    if verify or rollback:
        try:
            orig = mb_read1(master, unit_id, addr)
        except Exception:
            orig = None
    for _ in range(retries):
        try:
            master.execute(unit_id, cst.WRITE_SINGLE_REGISTER, addr, output_value=value)
            if verify:
                try:
                    rb = mb_read1(master, unit_id, addr)
                    if rb != value:
                        raise Exception(f"verify failed at {addr}: expect {value}, got {rb}")
                except Exception as ve:
                    last_err = ve
                    if rollback and orig is not None:
                        try:
                            master.execute(unit_id, cst.WRITE_SINGLE_REGISTER, addr, output_value=orig)
                        except Exception:
                            pass
                    time.sleep(interval)
                    continue
            return True
        except Exception as e:
            last_err = e
            time.sleep(interval)
    raise last_err or Exception("mb_write_reg failed")

# ---- 延遲與重試設定 ----
DELAY_STEP = int(config.get('delays', 'step_seconds', fallback='30'))  # 每步驟延遲秒數（預設30秒）
RETRY_CONNECT = int(config.get('delays', 'retry_connect', fallback='3'))
RETRY_INTERVAL = float(config.get('delays', 'retry_interval', fallback='1'))

def sleep_delay(label: str, seconds: int | None = None):
    s = seconds or DELAY_STEP
    add_log(f"{label} 等待 {s} 秒")
    time.sleep(s)

# ---- 連線助手（含重試） ----
def connect_device_master(name: str, timeout_in_sec: int = 3, retries: int = RETRY_CONNECT, interval: float = RETRY_INTERVAL):
    """依設備名稱取得 Modbus Master，帶重試與線上檢查。"""
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            m = get_device_master(name, timeout_in_sec=timeout_in_sec)
            return m
        except Exception as e:
            last_err = e
            logger.warning(f"connect_device_master: {name} attempt {attempt}/{retries} failed: {e}")
            time.sleep(interval)
    raise last_err or Exception(f"Failed to connect {name}")

# 設備連接池
devices = {
    "sbms": {"name": "SBMS", 
             "ip": config.get("devices", "sbms_ip", fallback="127.0.0.1"), 
             "port": int(config.get("devices", "sbms_port", fallback=502)), 
             "connected": False,
             "poweron": False,  # 是否啟動
             "power": 0,        # 輸出功率
             "soc": 0,          # SOC
             "soh": 0,          # SOH
             "active": False,   # 是否啟動
             "frequency": 60,   # 頻率
             "voltage": 0,      # 電壓
             "capacity": 0,     # 電量
             "temperature":0,   # 溫度
             "dcvoltage": 0,    # 直流電壓
             "current": 0},     # 電流                 
    "pcs": {"name": "PCS", 
            "ip": config.get("devices", "pcs_ip", fallback="127.0.0.1"), 
            "port": int(config.get("devices", "pcs_port", fallback=502)),
            "connected": False,
            "poweron": False,  # 是否啟動
            "pcsstatus": 0,
            "gridstatus": 0,
            "current": 0,  
            "operationmode": False,
            "power": 0,
            "frequency":0, #每調低0.01會開始增加充電功率加速充電
            "supplyfrequency": 0,
            "temperature": 0,
            "dcvoltage":0,
            "fault":0,
            "linevoltage":0,
            "linefrequency":0},
    "pn14": {"name": "PN14", 
            "host": config.get("Mqtt", "Host", fallback="smartgrid.cloudcleanenergy.com"), 
            "port": int(config.get("Mqtt", "Port", fallback=11883)),
            "username": config.get("Mqtt", "Username", fallback="aisails"),
            "password": config.get("Mqtt", "Password", fallback="W8dT4Lz3"),
            "clientid": config.get("Mqtt", "ClientID", fallback="mqtt-explorer-18a7cc46"),
            "topic_prefix": config.get("Mqtt", "Topic_Prefix", fallback="PN14-00004"),
            "connected": False,
            "poweron": False,  # 是否啟動
            "wind": 0,
            "power": 0,
            "soc": 0,
            "soh": 0,  
            "active": False,
            "frequency": 60,
            "supplyfrequency": 0,
            "temperature": 0,
            "dcvoltage":0,
            "fault":0,
            "linevoltage":0,
            "linefrequency":0,
            "last_mqtt": 0.0,
            # 新增：預先建立空的分組，便於前端直接渲染
            "groups": {code: {} for code in PN14_GROUP_NAMES.keys()}},              
    "diesel": {"name": "DG",
            "ip": config.get("devices", "diesel_ip", fallback="127.0.0.1"),
            "port": int(config.get("devices", "diesel_port", fallback=502)),
            "connected": False,
            "poweron": False,  # 是否啟動
            "active": False,
            "l3l1voltage": 0,
            "l2l3voltage": 0,
            "l1l2voltage": 0, 
            "l3current": 0,
            "l2current": 0, 
            "l1current": 0,
            "frequency": 0,
            "l3power": 0,
            "l2power": 0,
            "l1power": 0,
            "oilpressure": 0, 
            "coolertemperature": 0,
            "batteryvoltage": 0,
            "chargemagneticvoltage": 0,
            "status": 0}
}

# Modbus 主站連接池
masters = {}
lock = Lock()
logger = create_logger("console", level=logging.DEBUG)

def on_after_recv(data):
        master, bytes_data = data
        logger.info(bytes_data)

hooks.install_hook('modbus.Master.after_recv', on_after_recv)

# 提供依設備名稱即時建立 Modbus 連線的工具函式
def get_device_master(name: str, timeout_in_sec: int = 3):
    dev = devices.get(name)
    if not dev:
        raise Exception(f"Unknown device: {name}")
    host = dev.get("ip")
    port = dev.get("port")
    if not host or not port:
        raise Exception(f"Device {name} IP/Port not configured")
    m = modbus_tcp.TcpMaster(host=host, port=port, timeout_in_sec=timeout_in_sec)
    m.set_timeout(1)
    # 確認設備在線（讀取暫存器0，避免誤發指令）
    m.execute(1, cst.READ_HOLDING_REGISTERS, 0, 1)
    return m

# 讀取 MQTT 設定（供 PN14 使用）
mqtt_host = config.get('Mqtt', 'Host', fallback='').strip()
mqtt_port = int(config.get('Mqtt', 'Port', fallback='11883').strip())
mqtt_user = (config.get('Mqtt', 'Username', fallback='').strip() or None)
mqtt_pass = (config.get('Mqtt', 'Password', fallback='').strip() or None)
mqtt_clientid = config.get('Mqtt', 'ClientID', fallback='').strip() or None
mqtt_topic_prefix = config.get('Mqtt', 'Topic_Prefix', fallback='PN14-00004').strip()
# 若未提供 Topic_PN14，預設使用 prefix/#
_raw_topic = config.get('Mqtt', 'Topic_PN14', fallback='').strip()
if not _raw_topic:
    mqtt_topic_pn14 = f"{mqtt_topic_prefix}/#"
else:
    # 若沒有萬用字元，補上 /# 以覆蓋前綴底下所有子主題
    mqtt_topic_pn14 = _raw_topic if ('#' in _raw_topic or '+' in _raw_topic) else (_raw_topic.rstrip('/') + '/#')

mqtt_timeout_sec = int(config.get('Mqtt', 'Timeout_Sec', fallback='15').strip())  # 幾秒內收到訊息視為連線中

# 啟動 MQTT 監聽以更新 PN14 狀態

def _normalize_key(s: str) -> str:
    k = (s or '').strip().lower().replace(' ', '').replace('-', '').replace('_', '')
    mapping = {
        'wind': 'wind', 'windspeed': 'wind', 'windmps': 'wind', 'winds': 'wind',
        'force': 'force', 'tension': 'force', 'pull': 'force',
        'status': 'status', 'state': 'status'
    }
    return mapping.get(k, s)

def start_mqtt_listener():
    if mqtt is None:
        logger.warning("paho-mqtt 未安裝，PN14 將不透過 MQTT 更新")
        return
    if not mqtt_host:
        logger.warning("未在 config.cfg 設定 [mqtt] host，PN14 將不透過 MQTT 更新")
        return

    def _on_connect(client, userdata, flags, rc):
        if rc == 0:
            try:
                client.subscribe(mqtt_topic_pn14, qos=1)
                add_log(f"MQTT 已連線至 {mqtt_host}:{mqtt_port}，訂閱: {mqtt_topic_pn14}")
            except Exception as e:
                logger.error(f"MQTT subscribe 失敗: {e}")
        else:
            logger.error(f"MQTT 連線失敗 rc={rc}")

    def _on_message(client, userdata, msg):
        try:
            text = msg.payload.decode('utf-8', errors='replace')
        except Exception:
            text = str(msg.payload)
        topic_key = (msg.topic.split('/')[-1] if '/' in msg.topic else msg.topic).strip().lower()
        with lock:
            pn14 = devices.get('pn14', {})
            # 初始化分組容器（僅建立 config 定義的群組）
            groups = pn14.get('groups')
            if not isinstance(groups, dict):
                groups = {code: {} for code in PN14_GROUP_NAMES.keys()}
            # 儲存最後訊息
            pn14['last_topic'] = msg.topic
            pn14['last_payload'] = text
            # 嘗試 JSON：僅接受有在 PN14_FIELD_MAP 的鍵
            try:
                obj = json.loads(text)
                if isinstance(obj, dict):
                    for k, v in obj.items():
                        key = str(k).strip().lower()
                        if key in PN14_FIELD_MAP:
                            cat, label = PN14_FIELD_MAP[key]
                            if cat in PN14_GROUP_NAMES:
                                groups.setdefault(cat, {})[label] = v
                        else:
                            # 未在映射內的欄位歸入 others（若有定義）
                            if 'others' in PN14_GROUP_NAMES:
                                try:
                                    vv = json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v
                                except Exception:
                                    vv = str(v)
                                groups.setdefault('others', {})[str(k)] = vv
                else:
                    raise ValueError('not a dict')
            except Exception:
                # 非 JSON：優先使用 [PN14.topics.*] 的來源鍵映射；否則用 Topic 第二段群組 + 最後一段欄位，最後再落入 others
                parts = msg.topic.split('/')
                leaf_key = (parts[-1] if parts else '').strip().lower()
                used = False
                if leaf_key in PN14_FIELD_MAP:
                    cat_cfg, label_cfg = PN14_FIELD_MAP[leaf_key]
                    if cat_cfg in PN14_GROUP_NAMES:
                        try:
                            val = float(text)
                        except Exception:
                            val = text
                        groups.setdefault(cat_cfg, {})[label_cfg] = val
                        used = True
                if not used and len(parts) >= 3:
                    raw_cat = parts[1]
                    cat = PN14_GROUP_CANON.get(_normalize_group_code(raw_cat), None)
                    label = parts[-1]
                    if cat and cat in PN14_GROUP_NAMES:
                        try:
                            val = float(text)
                        except Exception:
                            val = text
                        groups.setdefault(cat, {})[label] = val
                        used = True
                if not used and 'others' in PN14_GROUP_NAMES:
                    # 以最後一段或整個 topic 作為欄位名稱
                    label = parts[-1] if parts else topic_key
                    try:
                        val = float(text)
                    except Exception:
                        val = text
                    groups.setdefault('others', {})[label] = val
            # 更新常用頂層欄位（若可推得）
            try:
                if 'WeatherStation' in groups:
                    for lk in groups['WeatherStation'].keys():
                        lk_l = lk.lower()
                        if 'windspeed' in lk_l or 'wind' in lk_l:
                            pn14['wind'] = groups['WeatherStation'][lk]
                            break
                if 'TowingWinch' in groups:
                    for lk in groups['TowingWinch'].keys():
                        lk_l = lk.lower()
                        if 'force' in lk_l or 'tension' in lk_l:
                            pn14['force'] = groups['TowingWinch'][lk]
                            break
            except Exception:
                pass
            # 僅保留 config 中定義的群組
            pn14['groups'] = {k: groups.get(k, {}) for k in PN14_GROUP_NAMES.keys()}
            pn14['last_mqtt'] = time.time()
            devices['pn14'] = pn14
        logger.debug(f"MQTT {msg.topic}: {text}")

    client = mqtt.Client(client_id=mqtt_clientid) if mqtt_clientid else mqtt.Client()
    if mqtt_user:
        client.username_pw_set(mqtt_user, mqtt_pass or '')
    client.on_connect = _on_connect
    client.on_message = _on_message
    # 自動重連延遲
    client.reconnect_delay_set(min_delay=1, max_delay=60)
    while True:
        try:
            client.connect(mqtt_host, mqtt_port, keepalive=60)
            client.loop_forever()
        except Exception as e:
            logger.error(f"MQTT 連線錯誤，5秒後重試: {e}")
            time.sleep(5)

# -------- 配置解析工具：SBMS/PCS 對照表 --------
def _apply_scale(raw: int, scale: float, bias: float) -> float:
    try:
        return (raw + bias) * scale
    except Exception:
        return raw

def _sbms_decode_from_config(master, devdict: dict):
    # 依 sbms.poll 讀取 discrete/input/holding
    dstart = cfg_int('sbms.poll','discrete_start',1)
    dlen = cfg_int('sbms.poll','discrete_len',80)
    istart = cfg_int('sbms.poll','input_start',1)
    ilen = cfg_int('sbms.poll','input_len',47)
    hstart = cfg_int('sbms.poll','holding_start',500)
    hlen = cfg_int('sbms.poll','holding_len',12)
    discretes = master.execute(SBMS_REG.unit, cst.READ_DISCRETE_INPUTS, dstart, dlen)
    holdings = master.execute(SBMS_REG.unit, cst.READ_HOLDING_REGISTERS, hstart, hlen)
    inputs = master.execute(SBMS_REG.unit, cst.READ_INPUT_REGISTERS, istart, ilen)
    # 建立來源查詢
    def get_val(source: str, idx: int) -> int:
        if source == 'input':
            base = istart
            arr = inputs
        else:
            base = hstart
            arr = holdings
        rel = idx - base + 1 # 因為 Modbus 地址從1開始
        if 0 <= rel < len(arr):
            return arr[rel]
        return 0
    # 解析 sbms.map
    if config.has_section('sbms.map'):
        items = dict(config.items('sbms.map'))
        # power/voltage/current...
        for key, spec in items.items():
            try:
                parts = [p.strip() for p in spec.split(',')]
                source = parts[0]
                idx = int(parts[1])
                scale = float(parts[2]) if len(parts) > 2 else 1.0
                bias = float(parts[3]) if len(parts) > 3 else 0.0
                raw = get_val(source, idx)
                val = _apply_scale(raw, scale, bias)
                if key == 'map_active_code':
                    code = int(val)
                    label = config.get('sbms.lookup', f'active_{code}', fallback=str(code)) if config.has_section('sbms.lookup') else str(code)
                    devdict['active'] = label
                elif key == 'map_charge_code':
                    code = int(val)
                    label = config.get('sbms.lookup', f'charge_{code}', fallback=str(code)) if config.has_section('sbms.lookup') else str(code)
                    devdict['status'] = label
                else:
                    # 去掉 map_ 前綴
                    field = key.replace('map_', '', 1)
                    devdict[field] = val
            except Exception:
                continue


def _pcs_summary_from_config(sumdata: list, devdict: dict):
    # 位元判斷
    try:
        idx_mask = config.get('pcs.summary','pcsstatus_fault_bit',fallback=None)
        if idx_mask:
            idx_s, mask_s = [x.strip() for x in idx_mask.split(',')]
            idx, mask = int(idx_s), int(mask_s, 0)
            devdict['pcsstatus'] = 'Fault' if (sumdata[idx] & mask) else 'Normal'
        idx_mask = config.get('pcs.summary','gridstatus_charge_bit',fallback=None)
        if idx_mask:
            idx_s, mask_s = [x.strip() for x in idx_mask.split(',')]
            idx, mask = int(idx_s), int(mask_s, 0)
            devdict['gridstatus'] = 'Charging' if (sumdata[idx] & mask) else 'Discharge'
    except Exception:
        pass
    # 一般欄位
    for key, spec in config.items('pcs.summary') if config.has_section('pcs.summary') else []:
        if key.endswith('_bit'):
            continue
        try:
            parts = [p.strip() for p in spec.split(',')]
            idx = int(parts[0]); scale = float(parts[1]) if len(parts) > 1 else 1.0
            signed = (len(parts) > 2 and parts[2].lower() == 'signed')
            raw = sumdata[idx]
            if signed and raw >= 0x8000:
                raw = raw - 0x10000
            val = raw * scale
            if key == 'operationmode':
                code = int(val)
                devdict['operationmode'] = config.get('pcs.lookup', f'opmode_{code}', fallback=str(code))
            elif key == 'power':
                devdict['power'] = val
            elif key == 'faultcode':
                devdict['fault'] = 'Not found' if raw == 0 else 'Error!'
            else:
                devdict[key] = val
        except Exception:
            continue
    # 活性
    devdict['active'] = True if float(devdict.get('current',0)) > 0 else False
    # 若未填入 frequency，則用 supplyfrequency 或 linefrequency 回補
    if 'frequency' not in devdict:
        try:
            f = devdict.get('supplyfrequency') or devdict.get('linefrequency')
            if f is not None:
                devdict['frequency'] = f
        except Exception:
            pass

def check_connections():
    """定時檢查設備連接狀態（每次讀取後關閉連線以避免累積）。"""
    while True:
        for name, dev in devices.items():
            # PN14：改用 MQTT 最近訊息時間判斷，不再透過 Modbus
            if name == 'pn14':
                now = time.time()
                last = float(dev.get('last_mqtt', 0) or 0)
                dev['connected'] = (now - last) <= mqtt_timeout_sec
                # 若無狀態，給個簡單字串
                if dev['connected'] and not dev.get('status'):
                    dev['status'] = 'Active'
                elif not dev['connected']:
                    dev['status'] = 'Inactive'
                continue

            master = None
            try:
                with lock:
                    master = modbus_tcp.TcpMaster(dev["ip"], dev["port"], timeout_in_sec=1)
                    master.set_timeout(1)
                    master.execute(1, cst.READ_HOLDING_REGISTERS, 0, 1)  # 存活檢查
                    dev["connected"] = True
                    
                    if name == "pcs":
                        summary_data = master.execute(PCS_REG.unit, cst.READ_HOLDING_REGISTERS, PCS_REG.summary_start, PCS_REG.summary_len)
                        _pcs_summary_from_config(summary_data, devices[name])
                    elif name == "sbms":
                        _sbms_decode_from_config(master, devices[name])
                        # 讀取空調監控暫存器（若在 config.cfg 中有設定）
                        try:
                            ac_vals = {}
                            if SBMS_AC_REG.ac_cooling >= 0:
                                ac_vals['ac_cooling'] = mb_read1(master, SBMS_REG.unit, SBMS_AC_REG.ac_cooling)
                            if SBMS_AC_REG.ac_heating >= 0:
                                ac_vals['ac_heating'] = mb_read1(master, SBMS_REG.unit, SBMS_AC_REG.ac_heating)
                            if SBMS_AC_REG.ac_temperature >= 0:
                                ac_vals['ac_temperature'] = mb_read1(master, SBMS_REG.unit, SBMS_AC_REG.ac_temperature)
                            if SBMS_AC_REG.ac_humidity >= 0:
                                ac_vals['ac_humidity'] = mb_read1(master, SBMS_REG.unit, SBMS_AC_REG.ac_humidity)
                            # 套用 AC 比例尺
                            for fld, val in list(ac_vals.items()):
                                sc, bs = AC_SCALES.get(fld, (1.0, 0.0))
                                ac_vals[fld] = _apply_scale(val, sc, bs)
                            devices[name].update(ac_vals)
                            # 狀態/模式推導
                            cool = int(devices[name].get('ac_cooling', 0) or 0)
                            heat = int(devices[name].get('ac_heating', 0) or 0)
                            if cool:
                                devices[name]['ac_mode'] = 'Cooling'
                                devices[name]['ac_status'] = 'Running'
                            elif heat:
                                devices[name]['ac_mode'] = 'Heating'
                                devices[name]['ac_status'] = 'Running'
                            else:
                                devices[name]['ac_mode'] = 'Idle'
                                devices[name]['ac_status'] = 'Standby'
                        except Exception as _:
                            pass
                        # 讀取 UPS 監控暫存器（若在 config.cfg 中有設定）
                        try:
                            ups_vals = {}
                            if SBMS_UPS_REG.upsoutcurrent >= 0:
                                ups_vals['ups_outcurrent'] = mb_read1(master, SBMS_REG.unit, SBMS_UPS_REG.upsoutcurrent)
                            if SBMS_UPS_REG.upsoutvoltage >= 0:
                                ups_vals['ups_outvoltage'] = mb_read1(master, SBMS_REG.unit, SBMS_UPS_REG.upsoutvoltage)
                            if SBMS_UPS_REG.upsoutpower >= 0:
                                ups_vals['ups_outpower'] = mb_read1(master, SBMS_REG.unit, SBMS_UPS_REG.upsoutpower)
                            if SBMS_UPS_REG.upsinvoltage >= 0:
                                ups_vals['ups_involtage'] = mb_read1(master, SBMS_REG.unit, SBMS_UPS_REG.upsinvoltage)
                            if SBMS_UPS_REG.upscapacity >= 0:
                                ups_vals['ups_capacity'] = mb_read1(master, SBMS_REG.unit, SBMS_UPS_REG.upscapacity)
                            if SBMS_UPS_REG.upsloadpercent >= 0:
                                ups_vals['ups_loadpercent'] = mb_read1(master, SBMS_REG.unit, SBMS_UPS_REG.upsloadpercent)
                            if SBMS_UPS_REG.upsbatteryvoltage >= 0:
                                ups_vals['ups_batteryvoltage'] = mb_read1(master, SBMS_REG.unit, SBMS_UPS_REG.upsbatteryvoltage)
                            # 套用 UPS 比例尺
                            for fld, val in list(ups_vals.items()):
                                sc, bs = UPS_SCALES.get(fld, (1.0, 0.0))
                                ups_vals[fld] = _apply_scale(val, sc, bs)
                            devices[name].update(ups_vals)
                            # 推導 UPS 狀態字串
                            ov = float(devices[name].get('ups_outvoltage') or 0)
                            bv = float(devices[name].get('ups_batteryvoltage') or 0)
                            ld = float(devices[name].get('ups_loadpercent') or 0)
                            devices[name]['ups_status'] = 'Running' if (ov > 0 or bv > 0 or ld > 0) else 'Standby'
                        except Exception:
                            pass
                        # 單位輸出（供前端使用）
                        units = dict(devices[name].get('units') or {})
                        for k, v in UPS_UNITS.items():
                            units[k] = v
                        for k, v in AC_UNITS.items():
                            units[k] = v
                        devices[name]['units'] = units
                    elif name == "diesel":
                        dg_data = master.execute(DIESEL_REG.unit, cst.READ_HOLDING_REGISTERS, DIESEL_REG.status_start, DIESEL_REG.status_len)
                        devices[name]["l1l2voltage"] = dg_data[0]  
                        devices[name]["l2l3voltage"] = dg_data[1]
                        devices[name]["l3l1voltage"] = dg_data[2]                                                      
                        devices[name]["l1current"] = dg_data[3]                            
                        devices[name]["l2current"] = dg_data[4]                            
                        devices[name]["l3current"] = dg_data[5]                            
                        devices[name]["frequency"] = dg_data[6] / 100                            
                        devices[name]["l1power"] = dg_data[7]                            
                        devices[name]["l2power"] = dg_data[8]                            
                        devices[name]["l3power"] = dg_data[9]                            
                        devices[name]["oilpressure"] = dg_data[10]                            
                        devices[name]["coolertemperature"] = dg_data[11]                            
                        devices[name]["batteryvoltage"] = dg_data[12] / 10                           
                        devices[name]["chargemagneticvoltage"] = dg_data[13]  / 10           
                        
                        status_bits = dg_data[14]
                        status = "Manual" if status_bits & 0x08 else "Auto"
                        status += " Started" if status_bits & 0x01 else "Stopped"
                        status += " ACB ON" if status_bits & 0x20 else " ACB OFF"
                        devices[name]["status"] = status
                        # 手動模式與啟動狀態旗標
                        devices[name]["manual_mode"] = bool(status_bits & DIESEL_VAL.status_bit_manual)
                        devices[name]["started"] = bool(status_bits & DIESEL_VAL.status_bit_started)
                        
                        devices[name]["fuel"] = dg_data[15] if len(dg_data) > 15 else 0
                        devices[name]["power"] = devices[name]["l1power"] + devices[name]["l2power"] + devices[name]["l3power"]
                        devices[name]["temperature"] = devices[name]["coolertemperature"]
                    
            except Exception as e:
                dev["connected"] = False
                masters.pop(name, None)
                logger.error(f"設備 {name} ({dev['ip']}:{dev['port']}) 連接失敗或超時: {e}")
            finally:
                try:
                    if master is not None:
                        master.close()
                except Exception:
                    pass
        time.sleep(1)        

@app.route('/')
def index():
    """前端頁面"""
    return render_template('index.html')

@app.route('/status')
def get_status():
    """獲取所有設備狀態"""
    return jsonify({
        "devices": {
            name: {
                "name": dev.get("name"),
                "ip": dev.get("ip", dev.get("host", "")),
                "port": dev.get("port", ""),
                "frequency": dev.get("frequency"),
                "connected": dev.get("connected", False),
                # diesel 專屬欄位
                **({
                    "l3l1voltage": dev.get("l3l1voltage"),
                    "l2l3voltage": dev.get("l2l3voltage"),
                    "l1l2voltage": dev.get("l1l2voltage"),
                    "l3current": dev.get("l3current"),
                    "l2current": dev.get("l2current"),
                    "l1current": dev.get("l1current"),
                    "l3power": dev.get("l3power"),
                    "l2power": dev.get("l2power"),
                    "l1power": dev.get("l1power"),
                    "oilpressure": dev.get("oilpressure"),
                    "coolertemperature": dev.get("coolertemperature"),
                    "batteryvoltage": dev.get("batteryvoltage"),
                    "chargemagneticvoltage": dev.get("chargemagneticvoltage"),
                    "status": dev.get("status"),
                    "power": dev.get("power"),
                    "fuel": dev.get("fuel", "--"),
                    "temperature": dev.get("coolertemperature"),
                    "manual_mode": dev.get("manual_mode", False),
                    "started": dev.get("started", False),
                } if name == "diesel" else {}),
                # pcs 專屬欄位
                **({
                    "pcsstatus": dev.get("pcsstatus"),
                    "gridstatus": dev.get("gridstatus"),
                    "current": dev.get("current"),
                    "operationmode": dev.get("operationmode"),
                    "power": dev.get("power"),
                    "supplyfrequency": dev.get("supplyfrequency"),
                    "temperature": dev.get("temperature"),
                    "dcvoltage": dev.get("dcvoltage"),
                    "fault": dev.get("fault"),
                    "linevoltage": dev.get("linevoltage"),
                    "linefrequency": dev.get("linefrequency"),
                    # 儀表板設定（提供前端完整繪製所需範圍/門檻）
                    "gauge": PCS_GAUGE,
                } if name == "pcs" else {}),
                # sbms 專屬欄位
                **({
                    "power": dev.get("power"),
                    "soc": dev.get("soc"),
                    "soh": dev.get("soh"),
                    "active": dev.get("active"),
                    "status": dev.get("status"),
                    "voltage": dev.get("voltage"),
                    "capacity": dev.get("capacity"),
                    "temperature": dev.get("temperature"),
                    "dcvoltage": dev.get("dcvoltage"),
                    "current": dev.get("current"),
                    # 空調資訊：由 config.cfg 的暫存器讀取
                    "ac_status": dev.get("ac_status"),
                    "ac_mode": dev.get("ac_mode"),
                    "ac_temperature": dev.get("ac_temperature"),
                    "ac_humidity": dev.get("ac_humidity"),
                    # UPS 資訊
                    "ups_status": dev.get("ups_status"),
                    "ups_outvoltage": dev.get("ups_outvoltage"),
                    "ups_involtage": dev.get("ups_involtage"),
                    "ups_loadpercent": dev.get("ups_loadpercent"),
                    "ups_batteryvoltage": dev.get("ups_batteryvoltage"),
                    "ups_capacity": dev.get("ups_capacity"),
                    "ups_outpower": dev.get("ups_outpower"),
                    "ups_outcurrent": dev.get("ups_outcurrent"),
                    # 單位表
                    "units": dev.get("units", {}),
                } if name == "sbms" else {}),
                # pn14 固定欄位 + 動態分組（僅限於 config 定義）
                **({
                    "wind": dev.get("wind", "--"),
                    "force": dev.get("force", "--"),
                    "status": dev.get("status", "--"),
                    "last_topic": dev.get("last_topic", ""),
                    "last_payload": dev.get("last_payload", ""),
                    # 僅包含 config 中存在的群組
                    "groups": {k: dev.get("groups", {}).get(k, {}) for k in PN14_GROUP_NAMES.keys()},
                    # 由 config.cfg 定義的群組標題對應
                    "group_names": PN14_GROUP_NAMES,
                    # 上次 MQTT 收到距今秒數與判斷門檻
                    "last_seen": (time.time() - float(dev.get('last_mqtt', 0) or 0)) if dev.get('last_mqtt') else None,
                    "timeout_sec": mqtt_timeout_sec,
                    "details": {
                        k: v for k, v in dev.items()
                        if k not in {
                            'name','connected','poweron','last_mqtt','last_topic','last_payload',
                            'frequency','supplyfrequency','temperature','dcvoltage','fault','linevoltage','linefrequency',
                            'host','ip','port','username','password','clientid','topic_prefix',
                            'wind','force','status','power','soc','soh','active','capacity','groups'
                        }
                    }
                } if name == "pn14" else {})
            } for name, dev in devices.items()
        },
        "global_status": all(dev.get("connected", False) for dev in devices.values())
    })

def execute_modbus_command(master, action):
    """執行Modbus命令的通用邏輯（系統級動作會自行建立設備連線）"""
    start = time.time()
    try:
        if action == "start_microgrid":
            sbms_master = connect_device_master("sbms")
            pcs_master = connect_device_master("pcs")
            try:
                # 1) SBMS clear fault
                mb_write_reg(sbms_master, SBMS_REG.unit, SBMS_REG.clear_fault, 1, verify=True)
                add_log("SBMS clear fault 完成")
                sleep_delay("clear_sbms_fault 後")
                # 2) SBMS power on（先 power_cmd 準備，再上電）
                mb_write_reg(sbms_master, SBMS_REG.unit, SBMS_REG.clear_fault, 1, verify=True)
                time.sleep(10)
                mb_write_reg(sbms_master, SBMS_REG.unit, SBMS_REG.power_cmd, 1, verify=True)
                add_log("SBMS power on 完成")
                sleep_delay("power_on_sbms 後")
                # 3) Precharge
                _ = mb_read(sbms_master, SBMS_REG.unit, cst.READ_HOLDING_REGISTERS, SBMS_REG.precharge, 1)
                mb_write_reg(sbms_master, SBMS_REG.unit, SBMS_REG.precharge, SBMS_VAL.precharge_close_cmd, verify=False)
                add_log("SBMS precharge 完成")
                sleep_delay("close_precharge_switch 後")
                # 4) 關閉 DC
                dc_state = mb_read1(sbms_master, SBMS_REG.unit, SBMS_REG.dc_switch)
                if dc_state != SBMS_VAL.dc_close:
                    mb_write_reg(sbms_master, SBMS_REG.unit, SBMS_REG.dc_switch, SBMS_VAL.dc_close, verify=True, rollback=True)
                add_log("SBMS DC close 完成")
                sleep_delay("close_dc_switch 後")
                # 5) PCS fault reset
                mb_write_reg(pcs_master, PCS_REG.unit, PCS_REG.control, PCS_VAL.cmd_fault_reset_on, verify=True, rollback=True)
                time.sleep(5)
                mb_write_reg(pcs_master, PCS_REG.unit, PCS_REG.control, PCS_VAL.cmd_fault_reset_off, verify=True, rollback=True)
                add_log("PCS fault reset 完成")
                sleep_delay("pcs_fault_reset 後")
                # 6) 檢查前置條件後 PCS run
                # Precondition: SBMS DC 已關閉 & Precharge 完成
                dc_state = mb_read1(sbms_master, SBMS_REG.unit, SBMS_REG.dc_switch)
                pre_st = mb_read1(sbms_master, SBMS_REG.unit, SBMS_REG.precharge)
                if dc_state != SBMS_VAL.dc_close:
                    raise Exception("前置條件未達：SBMS DC 未關閉")
                # 設備若無法讀回 precharge 狀態，這條可放寬
                if pre_st != SBMS_VAL.precharge_status:
                    logger.warning("Precharge 狀態讀回異常，仍嘗試 PCS Run")
                mb_write_reg(pcs_master, PCS_REG.unit, PCS_REG.control, PCS_VAL.cmd_run, verify=True, rollback=True)
                add_log("PCS run microgrid 完成")
            finally:
                try: sbms_master.close()
                except Exception: pass
                try: pcs_master.close()
                except Exception: pass
        elif action == "stop_microgrid":
            pcs_master = connect_device_master("pcs")
            sbms_master = connect_device_master("sbms")
            try:
                # 1) PCS stop
                mb_write_reg(pcs_master, PCS_REG.unit, PCS_REG.control, PCS_VAL.cmd_stop, verify=True, rollback=True)
                add_log("PCS stop microgrid 完成")
                sleep_delay("pcs_stop_microgrid 後")
                # 2) 開啟 DC
                dc_state = mb_read1(sbms_master, SBMS_REG.unit, SBMS_REG.dc_switch)
                if dc_state != SBMS_VAL.dc_open:
                    mb_write_reg(sbms_master, SBMS_REG.unit, SBMS_REG.dc_switch, SBMS_VAL.dc_open, verify=True, rollback=True)
                add_log("ESS open DC 完成")
                sleep_delay("open_dc_switch 後")
                # 3) Power off SBMS
                mb_write_reg(sbms_master, SBMS_REG.unit, SBMS_REG.power_cmd, 2, verify=True)
                add_log("ESS power off 完成")
            finally:
                try: pcs_master.close()
                except Exception: pass
                try: sbms_master.close()
                except Exception: pass
        else:
            # 非 system：需要 master 存在
            if master is None:
                raise Exception("Device master is not initialized for this action")
            # Diesel 操作
            if action == "start_dg":
                mb_write_reg(master, DIESEL_REG.unit, DIESEL_REG.start_stop, DIESEL_VAL.start, verify=True)
            elif action == "stop_dg":
                mb_write_reg(master, DIESEL_REG.unit, DIESEL_REG.start_stop, DIESEL_VAL.stop, verify=True)
            elif action == "acb_open":
                mb_write_reg(master, DIESEL_REG.unit, DIESEL_REG.acb, DIESEL_VAL.acb_open, verify=True)
            elif action == "acb_close":
                mb_write_reg(master, DIESEL_REG.unit, DIESEL_REG.acb, DIESEL_VAL.acb_close, verify=True)
            # SBMS 操作
            elif action == "open_dc_switch":
                state = mb_read1(master, SBMS_REG.unit, SBMS_REG.dc_switch)
                if state != SBMS_VAL.dc_open:
                    mb_write_reg(master, SBMS_REG.unit, SBMS_REG.dc_switch, SBMS_VAL.dc_open, verify=True, rollback=True)
            elif action == "close_dc_switch":
                state = mb_read1(master, SBMS_REG.unit, SBMS_REG.dc_switch)
                if state != SBMS_VAL.dc_close:
                    mb_write_reg(master, SBMS_REG.unit, SBMS_REG.dc_switch, SBMS_VAL.dc_close, verify=True, rollback=True)
            elif action == "close_pcs_switch":
                mb_write_reg(master, SBMS_REG.unit, SBMS_REG.precharge, SBMS_VAL.precharge_close_cmd, verify=False)
            elif action == "close_precharge_switch":
                _ = mb_read(master, SBMS_REG.unit, cst.READ_HOLDING_REGISTERS, SBMS_REG.precharge, 1)
                mb_write_reg(master, SBMS_REG.unit, SBMS_REG.precharge, SBMS_VAL.precharge_close_cmd, verify=False)
            elif action == "power_off_sbms":
                mb_write_reg(master, SBMS_REG.unit, SBMS_REG.power_cmd, 2, verify=True)
            elif action == "clear_sbms_fault":
                mb_write_reg(master, SBMS_REG.unit, SBMS_REG.clear_fault, 1, verify=True)
            elif action == "power_on_sbms":
                mb_write_reg(master, SBMS_REG.unit, SBMS_REG.clear_fault, 1, verify=True)
                time.sleep(10)
                mb_write_reg(master, SBMS_REG.unit, SBMS_REG.power_cmd, 1, verify=True)
            # PCS 操作
            elif action == "pcs_fault_reset":
                mb_write_reg(master, PCS_REG.unit, PCS_REG.control, PCS_VAL.cmd_fault_reset_on, verify=True, rollback=True)
                time.sleep(5)
                mb_write_reg(master, PCS_REG.unit, PCS_REG.control, PCS_VAL.cmd_fault_reset_off, verify=True, rollback=True)
            elif action == "pcs_freq_down":
                mb_write_reg(master, PCS_REG.unit, PCS_REG.freq_ctrl, PCS_VAL.freq_down, verify=True)
                time.sleep(2)
                mb_write_reg(master, PCS_REG.unit, PCS_REG.freq_ctrl, 0, verify=True)
            elif action == "pcs_freq_up":
                mb_write_reg(master, PCS_REG.unit, PCS_REG.freq_ctrl, PCS_VAL.freq_up, verify=True)
                time.sleep(2)
                mb_write_reg(master, PCS_REG.unit, PCS_REG.freq_ctrl, 0, verify=True)
            elif action == "pcs_run_microgrid":
                # 前置條件：SBMS DC 關閉 & Precharge 完成
                try:
                    sbms_m = connect_device_master("sbms")
                    dc_state = mb_read1(sbms_m, SBMS_REG.unit, SBMS_REG.dc_switch)
                    pre_st = mb_read1(sbms_m, SBMS_REG.unit, SBMS_REG.precharge)
                finally:
                    try:
                        sbms_m.close()
                    except Exception:
                        pass
                if dc_state != SBMS_VAL.dc_close:
                    raise Exception("前置條件未達：SBMS DC 未關閉，禁止 PCS Run")
                if pre_st != SBMS_VAL.precharge_status:
                    logger.warning("Precharge 狀態讀回異常，仍嘗試 PCS Run")
                mb_write_reg(master, PCS_REG.unit, PCS_REG.control, PCS_VAL.cmd_run, verify=True, rollback=True)
            elif action == "pcs_stop_microgrid":
                mb_write_reg(master, PCS_REG.unit, PCS_REG.control, PCS_VAL.cmd_stop, verify=True, rollback=True)
            elif action == "pcs_freq_reset":
                freq_now = devices["pcs"].get("frequency", 0)
                freq_target = devices["pcs"].get("supplyfrequency", freq_now)
                steps = int(round((freq_target - freq_now) / 0.01))
                if steps < 0:
                    steps = 0
                for _ in range(steps):
                    mb_write_reg(master, PCS_REG.unit, PCS_REG.freq_ctrl, PCS_VAL.freq_up, verify=True)
                    time.sleep(2)
                    mb_write_reg(master, PCS_REG.unit, PCS_REG.freq_ctrl, 0, verify=True)
            elif action == "pcs_read_summary":
                data = mb_read(master, PCS_REG.unit, cst.READ_HOLDING_REGISTERS, PCS_REG.summary_start, PCS_REG.summary_len)
                add_log(f"PCS summary: {list(data)}")
            else:
                raise Exception(f"Unsupported action: {action}")
    except Exception as e:
        raise e
    end = time.time()
    logger.info(f"Action {action} executed in {end - start:.2f} seconds")
    add_log(f"Action {action} executed in {end - start:.2f} seconds")

@app.route('/control', methods=['POST'])
def control_device():
    """控制設備（單一或全局）"""
    data = request.json
    device = data.get("device")
    action = data.get("action")

    if device not in devices and device != "system":
        return jsonify({"success": False, "error": "Invalid device"}), 400

    if device == "system":
        not_connected = [dev["name"] for dev in devices.values() if not dev["connected"]]
        if not_connected:
            return jsonify({
                "success": False,
                "error": f"以下設備未連接: {', '.join(not_connected)}"
            }), 500
    else:
        if not devices[device]["connected"]:
            return jsonify({
                "success": False,
                "error": f"{devices[device]['name']} 未連接",
                "device": device,
                "ip": devices[device]["ip"]
            }), 500

    if action not in [
        "operation", "shutdown",
        "start_dg", "stop_dg",
        "acb_open", "acb_close",
        "clear_sbms_fault",
        "close_dc_switch", "close_pcs_switch",
        "close_precharge_switch",
        "open_dc_switch",
        "pcs_fault_reset", "pcs_freq_up","pcs_freq_down","pcs_freq_reset","pcs_read_summary",
        "pcs_run_microgrid", "pcs_stop_microgrid",
        "power_off_sbms", "power_on_sbms",
        "run_microgrid", "stop_microgrid", "start_microgrid"]:
        return jsonify({"success": False, "error": "Invalid control command"}), 400

    master = None
    if device != "system":
        ip_address = devices[device]["ip"]
        port = devices[device]["port"]
        try:
            master = modbus_tcp.TcpMaster(host=ip_address, port=port, timeout_in_sec=3)
            master.set_timeout(1)
        except Exception as e:
            logger.error(f"Error connecting to {device} at {ip_address}:{port}: {str(e)}")
            add_log(f"Error connecting to {device} at {ip_address}:{port}: {str(e)}")
            return jsonify({"success": False, "error": str(e)}), 500

    try:
        execute_modbus_command(master, action)
        return jsonify({"success": True, "message": f"{devices[device]['name'] if device!='system' else 'System'} {action} executed success."})
    except Exception as e:
        logger.error(f"Error executing action {action}: {str(e)}")
        add_log(f"Error executing action {action}: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if master is not None:
            try:
                master.close()
            except Exception:
                pass

@app.route('/device_data')
def device_data():
    """返回設備狀態和充放電關係"""
    soc = devices["sbms"].get("soc", 0)
    connections = [
        {"from": "diesel", "to": "sbms", "active": soc < 90},
        {"from": "sbms", "to": "fuel_cell", "active": soc >= 90}
    ]
    return jsonify({
        "devices": devices,
        "connections": connections
    })

@app.route('/update_soc', methods=['POST'])
def update_soc():
    """更新儲能櫃的SOC數據"""
    data = request.json
    soc = data.get("soc")
    if soc is not None:
        devices["sbms"]["soc"] = soc
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "Invalid SOC value"}), 400

@app.route('/load-config', methods=['GET'])
def load_config():
    """從配置文件讀取參數"""
    config_data = {}
    for section in config.sections():
        config_data[section] = {key: config.get(section, key) for key in config.options(section)}
    return jsonify(config_data)

@app.route('/save-config', methods=['POST'])
def save_config():
    """將參數儲存到配置文件並即時重新載入相關快取"""
    data = request.json
    # 重建 config (失去註解屬正常行為)
    config.clear()
    for section, values in data.items():
        if not config.has_section(section):
            config.add_section(section)
        for key, value in values.items():
            config.set(section, key, str(value))
    with open('config.cfg', 'w', encoding='utf-8') as configfile:
        config.write(configfile)
    # 重新讀取並更新內部快取 (比例尺/單位/寄存器等)
    config.read('config.cfg', encoding='utf-8-sig')
    _reload_scales_units_and_registers()
    # 同步重載 PN14 群組/欄位映射
    _reload_pn14_mappings()
    return jsonify({"success": True, "message": "配置已更新並重新載入"})

@app.route('/aad-config', methods=['GET'])
def get_aad_config():
    """提供 AAD 配置給前端"""
    aad_config = {
        "clientId": config.get("aad", "client_id", fallback="a755bc53-ded3-42e1-9991-74f0d0288d97"),
        "authority": config.get("aad", "authority", fallback="https://login.microsoftonline.com/de0795e0-d7c0-4eeb-b9bb-bc94d8980d3b"),
        "redirectUri": config.get("aad", "redirect_uri", fallback="http://localhost:5000/auth-redirect")
    }
    return jsonify(aad_config)

@app.route('/settings')
def settings_page():
    """設定頁面（依 config.cfg 動態產生表單）"""
    return render_template('settings.html')

# --- log buffer 與API ---
log_buffer = deque(maxlen=500)
LOG_FILE = "logs.txt"
log_lock = threading.Lock()

def add_log(msg):
    t = time.strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{t}] {msg}"
    with log_lock:
        log_buffer.appendleft(line)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
# 啟動時載入舊log
if os.path.exists(LOG_FILE):
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        for line in f.readlines()[-500:]:
            log_buffer.appendleft(line.strip())

@app.route('/logs')
def get_logs():
    with log_lock:
        return jsonify(list(log_buffer))

if __name__ == "__main__":
    Thread(target=check_connections, daemon=True).start()
    # 啟動 MQTT 背景監聽
    Thread(target=start_mqtt_listener, daemon=True).start()
    # 啟動設定檔熱載入監看
    Thread(target=watch_config, daemon=True).start()
    app.run(host='0.0.0.0', port=5000)