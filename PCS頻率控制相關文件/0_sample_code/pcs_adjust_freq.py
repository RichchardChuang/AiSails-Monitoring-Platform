#!/usr/bin/env python
# -*- coding: utf_8 -*-
from __future__ import print_function

import modbus_tk
from modbus_tk import modbus_tcp, hooks
import logging, time

def main():
    logger = modbus_tk.utils.create_logger("console", level=logging.DEBUG)

    def on_after_recv(data):
        master, bytes_data = data
        logger.info(bytes_data)

    hooks.install_hook('modbus.Master.after_recv', on_after_recv)

    try:

        def on_before_connect(args):
            master = args[0]
            logger.debug("on_before_connect {0} {1}".format(master._host, master._port))

        hooks.install_hook("modbus_tcp.TcpMaster.before_connect", on_before_connect)

        def on_after_recv(args):
            response = args[1]
            logger.debug("on_after_recv {0} bytes received".format(len(response)))

        hooks.install_hook("modbus_tcp.TcpMaster.after_recv", on_after_recv)

        # Connect to the slave
        master = modbus_tcp.TcpMaster(host="192.168.127.231", port=502, timeout_in_sec= 1)
        master.set_timeout(1)
        logger.info("connected")
        
        start = time.time()
        #address 要比文件 - 1
        #Freq down
        #print(master.execute(1, 0x6, 2003, output_value=16))
        #Freq up
        #print(master.execute(1, 0x6, 2003, output_value=32))
        time.sleep(2)
        print(master.execute(1, 0x6, 2003, output_value=0))
        end = time.time()
        print(end - start)
    except modbus_tk.modbus.ModbusError as exc:
        logger.error("%s- Code=%d", exc, exc.get_exception_code())

if __name__ == "__main__":
    main()