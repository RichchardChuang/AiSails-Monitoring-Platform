from flask import Flask, jsonify, request, render_template
import modbus_tk.defines as cst
from modbus_tk import modbus_tcp,hooks
import configparser
from threading import Lock, Thread
import logging,time
from modbus_tk.utils import create_logger   
app = Flask(__name__)

# 讀取配置文件
config = configparser.ConfigParser()
config.read('config.cfg')

# 設備連接池
devices = {
    "sbms": {"name": "SBMS", 
             "ip": config.get("devices", "sbms_ip", fallback="127.0.0.1"), 
             "port": int(config.get("devices", "sbms_port", fallback=502)), 
             "connected": False,
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
            "ip": config.get("devices", "pn14_ip", fallback="127.0.0.1"), 
            "port": int(config.get("devices", "pn14_port", fallback=502)),
            "connected": False,
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
            "linefrequency":0},              
    "diesel": {"name": "DG",
            "ip": config.get("devices", "diesel_ip", fallback="127.0.0.1"),
            "port": int(config.get("devices", "diesel_port", fallback=502)),
            "connected": False,
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

def check_connections():
    """定時檢查設備連接狀態"""
    while True:
        for name, dev in devices.items():
            try:
                with lock:
                    master = modbus_tcp.TcpMaster(dev["ip"], dev["port"])
                    master.set_timeout(1)
                    master.execute(1, cst.READ_HOLDING_REGISTERS, 0, 1)
                    dev["connected"] = True
                    masters[name] = master
                    
                    if name == "pcs": # Read PCS Summary 2101
                        summary_data = master.execute(1, cst.READ_HOLDING_REGISTERS, 2101, 12)
                        devices[name]["pcsstatus"] = summary_data[0]
                        devices[name]["gridstatus"] = summary_data[1]
                        devices[name]["current"] = summary_data[2] / 10
                        devices[name]["active"] = True if devices[name]["current"] > 0 else False
                        devices[name]["operationmode"] = summary_data[3]
                        devices[name]["power"] = summary_data[4] / 100
                        devices[name]["frequency"] = summary_data[5] / 100
                        devices[name]["supplyfrequency"] = summary_data[6] / 100
                        devices[name]["temperature"] = summary_data[7]
                        devices[name]["dcvoltage"] = summary_data[8] / 10
                        devices[name]["fault"] = summary_data[9]
                        devices[name]["linevoltage"] = summary_data[10] / 10
                        devices[name]["linefrequency"] = summary_data[11] / 10
                    elif name == "sbms": # Read SBMS Data
                        sbms_data = master.execute(1, cst.READ_HOLDING_REGISTERS, 500, 10)
                        devices[name]["power"] = sbms_data[0] / 10
                        devices[name]["voltage"] = sbms_data[1] / 10 if len(sbms_data) > 1 else 0
                        devices[name]["current"] = sbms_data[2] / 10 if len(sbms_data) > 2 else 0
                        devices[name]["temperature"] = sbms_data[3] if len(sbms_data) > 3 else 0
                        devices[name]["soc"] = sbms_data[4] if len(sbms_data) > 4 else 0
                        devices[name]["soh"] = sbms_data[5] if len(sbms_data) > 5 else 0
                        devices[name]["capacity"] = sbms_data[6] / 10 if len(sbms_data) > 6 else 0
                        devices[name]["active"] = sbms_data[7] == 1 if len(sbms_data) > 7 else False
                        devices[name]["status"] = "Active" if devices[name]["active"] else "Inactive"
                    elif name == "diesel": # Read Diesel Generator Data 100
                        dg_data = master.execute(1, cst.READ_HOLDING_REGISTERS, 100, 16)  # 確保讀取16個寄存器
                        devices[name]["l3l1voltage"] = dg_data[0]                            
                        devices[name]["l2l3voltage"] = dg_data[1]                            
                        devices[name]["l1l2voltage"] = dg_data[2]                            
                        devices[name]["l3current"] = dg_data[3]                            
                        devices[name]["l2current"] = dg_data[4]                            
                        devices[name]["l1current"] = dg_data[5]                            
                        devices[name]["frequency"] = dg_data[6] / 100                            
                        devices[name]["l3power"] = dg_data[7]                            
                        devices[name]["l2power"] = dg_data[8]                            
                        devices[name]["l1power"] = dg_data[9]                            
                        devices[name]["oilpressure"] = dg_data[10]                            
                        devices[name]["coolertemperature"] = dg_data[11]                            
                        devices[name]["batteryvoltage"] = dg_data[12] / 10                           
                        devices[name]["chargemagneticvoltage"] = dg_data[13]  / 10                           
                        devices[name]["status"] = dg_data[14] # 0: 停止, 1: 啟動, 2: 運行, 3: 故障
                        devices[name]["fuel"] = dg_data[15] if len(dg_data) > 15 else 0  # 燃料數據
                        # 計算總功率
                        devices[name]["power"] = devices[name]["l1power"] + devices[name]["l2power"] + devices[name]["l3power"]
                        # 使用coolertemperature作為溫度
                        devices[name]["temperature"] = devices[name]["coolertemperature"]
                    elif name == "pn14": # Read PN14 Data
                        try:
                            pn14_data = master.execute(1, cst.READ_HOLDING_REGISTERS, 200, 5)
                            devices[name]["wind"] = pn14_data[0] / 10 if len(pn14_data) > 0 else 0
                            devices[name]["force"] = pn14_data[1] if len(pn14_data) > 1 else 0
                            devices[name]["status"] = "Active" if pn14_data[2] == 1 and len(pn14_data) > 2 else "Inactive"
                        except Exception as e:
                            logger.error(f"Error reading PN14 data: {e}")
            except Exception as e:
                dev["connected"] = False
                masters.pop(name, None)
                logger.error(f"設備 {name} ({dev['ip']}:{dev['port']}) 連接失敗或超時: {e}")
        
        time.sleep(1) #數值更新頻率幾秒鐘

@app.route('/')
def index():
    """渲染前端頁面"""
    return render_template('index.html')

@app.route('/status')
def get_status():
    """獲取所有設備狀態"""
    return jsonify({
        "devices": {
            name: {
                "name": dev["name"],
                "ip": dev["ip"],
                "port": dev["port"],
                "frequency": dev["frequency"],
                "connected": dev["connected"],
                # 柴油發電機卡片訊息完整提供給前端
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
                    "temperature": dev.get("coolertemperature"),  # 使用coolertemperature作為溫度
                } if name == "diesel" else {}),
                # PCS卡片訊息完整提供給前端
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
                } if name == "pcs" else {}),
                # SBMS卡片訊息完整提供給前端
                **({
                    "power": dev.get("power"),
                    "soc": dev.get("soc"),
                    "soh": dev.get("soh"),
                    "active": dev.get("active"),
                    "voltage": dev.get("voltage"),
                    "capacity": dev.get("capacity"),
                    "temperature": dev.get("temperature"),
                    "dcvoltage": dev.get("dcvoltage"),
                    "current": dev.get("current"),
                } if name == "sbms" else {}),
                # PN14卡片訊息完整提供給前端
                **({
                    "wind": dev.get("wind", "--"),
                    "force": dev.get("force", "--"),
                    "status": dev.get("status", "--"),
                } if name == "pn14" else {})
            } for name, dev in devices.items()
        },
        "global_status": all(dev["connected"] for dev in devices.values())
    })

def execute_modbus_command(master, action):
    """執行Modbus命令的通用邏輯"""
    start = time.time()
    try:
        if action == "operation":
            master.execute(1, cst.READ_HOLDING_REGISTERS, 501, 1)
        elif action == "shutdown":
            master.execute(1, cst.READ_HOLDING_REGISTERS, 501, 1)
        elif action == "start_dg":
            master.execute(1, cst.WRITE_SINGLE_REGISTER, 0x0007, output_value=1)
        elif action == "stop_dg":
            master.execute(1, cst.WRITE_SINGLE_REGISTER, 0x0007, output_value=2)
        elif action == "acb_open":
            master.execute(1, cst.WRITE_SINGLE_REGISTER, 0x0006, output_value=8)
        elif action == "acb_close":
            master.execute(1, cst.WRITE_SINGLE_REGISTER, 0x0006, output_value=4)
        elif action == "open_dc_switch":
            if master.execute(1, cst.READ_HOLDING_REGISTERS, 5, 1) != 1:
                master.execute(1, cst.WRITE_SINGLE_REGISTER, 5, output_value=1)
        elif action == "close_dc_switch":
            if master.execute(1, cst.READ_HOLDING_REGISTERS, 5, 1) != 2:
                master.execute(1, cst.WRITE_SINGLE_REGISTER, 5, output_value=2)
        elif action == "close_pcs_switch":
            master.execute(1, cst.WRITE_SINGLE_REGISTER, 6, output_value=1)
        elif action == "close_precharge_switch":
            master.execute(1, cst.READ_HOLDING_REGISTERS, 8, 1)
            master.execute(1, cst.WRITE_SINGLE_REGISTER, 8, output_value=7)
        elif action == "power_off_sbms":
            master.execute(1, cst.WRITE_SINGLE_REGISTER, 503, output_value=2)
        elif action == "clear_sbms_fault":
            master.execute(1, cst.WRITE_SINGLE_REGISTER, 501, output_value=1)
        elif action == "power_on_sbms":
            master.execute(1, cst.WRITE_SINGLE_REGISTER, 501, output_value=1)
            time.sleep(10)
            master.execute(1, cst.WRITE_SINGLE_REGISTER, 503, output_value=1)
            time.sleep(10)
        elif action == "pcs_fault_reset":
            master.execute(1, cst.WRITE_SINGLE_REGISTER, 2000, output_value=128)
            time.sleep(5)
            master.execute(1, cst.WRITE_SINGLE_REGISTER, 2000, output_value=0)
            time.sleep(0.1)
        elif action == "pcs_freq_down":
            master.execute(1, cst.WRITE_SINGLE_REGISTER, 2003, output_value= 16)
            time.sleep(2)
            master.execute(1, cst.WRITE_SINGLE_REGISTER, 2003, output_value= 0)
        elif action == "pcs_freq_up":
            master.execute(1, cst.WRITE_SINGLE_REGISTER, 2003, output_value= 32)
            time.sleep(2)
            master.execute(1, cst.WRITE_SINGLE_REGISTER, 2003, output_value= 0)
        elif action == "pcs_run_microgrid":
            master.execute(1, cst.WRITE_SINGLE_REGISTER, 2000, output_value=1024 + 1 + 8)
        elif action == "pcs_stop_microgrid":
            master.execute(1, cst.WRITE_SINGLE_REGISTER, 2000, output_value=1024)
        elif action == "pcs_freq_reset":
            # 將PCS頻率調整到60.00Hz，依據 supplyfrequency 與 frequency 差值，每 0.01 Hz 執行一次
            freq_now = devices["pcs"]["frequency"]
            freq_target = devices["pcs"]["supplyfrequency"]
            steps = int(round((freq_target - freq_now) / 0.01))
            if steps < 0:
                steps = 0
            for _ in range(steps):
                master.execute(1, cst.WRITE_SINGLE_REGISTER, 2003, output_value=32)  # freq up
                time.sleep(2)
                master.execute(1, cst.WRITE_SINGLE_REGISTER, 2003, output_value=0)
                time.sleep(0.1)
            # 實際應用可根據目前頻率與目標頻率的差距調整迴圈次數
    except Exception as e:
        raise e
    end = time.time()
    logger.info(f"Action {action} executed in {end - start:.2f} seconds")
    add_log(f"Action {action} executed in {end - start:.2f} seconds")

# 修改 control_device 函數以使用 execute_modbus_command
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
        "start", "stop"]:
        return jsonify({"success": False, "error": "Invalid control command"}), 400

    ip_address = devices[device]["ip"] if device != "system" else None
    port = devices[device]["port"] if device != "system" else None
    try:
        def on_before_connect(args):
            master = args[0]
            logger.debug("on_before_connect {0} {1}".format(master._host, master._port))

        hooks.install_hook("modbus_tcp.TcpMaster.before_connect", on_before_connect)

        def on_after_recv(args):
            response = args[1]
            logger.debug("on_after_recv {0} bytes received".format(len(response)))

        hooks.install_hook("modbus_tcp.TcpMaster.after_recv", on_after_recv)
        master = modbus_tcp.TcpMaster(host=ip_address, port=port, timeout_in_sec=3)
        master.set_timeout(1)
        
        execute_modbus_command(master, action)
        return jsonify({"success": True, "message": f"{devices[device]['name']} {action} executed success."})
    except Exception as e:
        logger.error(f"Error executing action {action}: {str(e)}")
        add_log(f"Error executing action {action}: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

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
    """將參數儲存到配置文件"""
    data = request.json
    config.clear()
    # 依照前端結構重建 config
    # 預期格式: {"overview": {"overview_ip": ...}, "devices": {"sbms_ip":..., ...}}
    for section, values in data.items():
        if not config.has_section(section):
            config.add_section(section)
        for key, value in values.items():
            config.set(section, key, str(value))
    with open('config.cfg', 'w') as configfile:
        config.write(configfile)
    return jsonify({"success": True, "message": "配置已更新"})

@app.route('/aad-config', methods=['GET'])
def get_aad_config():
    """提供 AAD 配置給前端"""
    aad_config = {
        "clientId": config.get("aad", "client_id", fallback="a755bc53-ded3-42e1-9991-74f0d0288d97"),
        "authority": config.get("aad", "authority", fallback="https://login.microsoftonline.com/de0795e0-d7c0-4eeb-b9bb-bc94d8980d3b"),
        "redirectUri": config.get("aad", "redirect_uri", fallback="http://localhost:5000/auth-redirect")
    }
    return jsonify(aad_config)

# --- 新增：log buffer 與API ---
from collections import deque
import threading
import os

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
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)