window.toolboxConfig = {
  kind: 'categoryToolbox',
  contents: [

    { kind: 'sep' },
    // ── Search ─────────────────────────────────────────────────────
    { kind: 'category', name: 'Search', custom: 'SEARCH_CATEGORY', colour: '#989898', id: 'cat_search' },
    { kind: 'sep' },

    // ── DIGITAL ──────────────────────────────────────────────────────
    {
      kind: 'category', name: 'Digital', colour: '#F4E9E3', id: 'cat_digital', contents: [
        { kind: 'block', type: 'din_sound' },
        { kind: 'block', type: 'din_tilt' },
        { kind: 'block', type: 'din_door' },
        { kind: 'block', type: 'din_button' },
        { kind: 'block', type: 'din_motion' },
        { kind: 'block', type: 'din_proximity' },
        { kind: 'block', type: 'din_ir' },
        { kind: 'block', type: 'din_flame' },
        { kind: 'block', type: 'load_cell' },
        { kind: 'block', type: 'steper' },
        { kind: 'block', type: 'waterpump' },
        { kind: 'block', type: 'solinoid' },
        { kind: 'block', type: 'animo' },
        { kind: 'block', type: 'relay' },
        { kind: 'block', type: 'buzzer' },
        { kind: 'block', type: 'minifan' },
        { kind: 'block', type: 'buzzer_component' },
        { kind: 'block', type: 'ir_sen' },
        { kind: 'block', type: 'touch_sensor' },
        { kind: 'block', type: 'peltier' },
        { kind: 'block', type: 'microwave_sensor' },
        { kind: 'block', type: 'speaker' },
        { kind: 'block', type: 'rotation_sensor' },
      ]
    },

    // ── ANALOG ───────────────────────────────────────────────────────
    {
      kind: 'category', name: 'Analog', colour: '#CDEEE6', id: 'cat_analog', contents: [
        { kind: 'block', type: 'tep_ana' },
        { kind: 'block', type: 'heart_beat' },
        { kind: 'block', type: 'soil_moisture' },
        { kind: 'block', type: 'dust' },
        { kind: 'block', type: 'vibration-switch-sensor' },
        { kind: 'block', type: 'Current-sensor' },
        { kind: 'block', type: 'IR-Temp' },
        { kind: 'block', type: 'din_ultra_range' },
        { kind: 'block', type: 'temp2-sensor' },
        { kind: 'block', type: 'ecg' },
        { kind: 'block', type: 'ana_temp' },
        { kind: 'block', type: 'water-turbidity-sensor' },
        { kind: 'block', type: 'shock_sensor' },
        { kind: 'block', type: 'flex-sensor' },
        { kind: 'block', type: 'Air_quality_sensor' },
        { kind: 'block', type: 'flexi_force_sensor' },
        { kind: 'block', type: 'TDS_Water_sensor' },
        { kind: 'block', type: 'ana_flame' },
        { kind: 'block', type: 'din_temp' },
        { kind: 'block', type: 'water_sensor' },
        { kind: 'block', type: 'din_ultra' },
        { kind: 'block', type: 'voltage_sensor' },
        { kind: 'block', type: 'humidity' },
        { kind: 'block', type: 'ldr' },
        { kind: 'block', type: 'joystick_move' },
        { kind: 'block', type: 'piezo_sensor' },
        { kind: 'block', type: 'water_level' },
        { kind: 'block', type: 'solor_panel' },
        { kind: 'block', type: 'admp' },
        { kind: 'block', type: 'uv_sensor_ana' },
        { kind: 'block', type: 'ph_sensor' },


      ]
    },

    // ── I2C ──────────────────────────────────────────────────────────
    {
      kind: 'category', name: 'I2c', colour: '#E8E5FB', id: 'cat_i2c', contents: [
        { kind: 'block', type: 'magnetic_sensor' },
        { kind: 'block', type: 'colour_sen' },
        { kind: 'block', type: 'accelerometer_sensor' },
        { kind: 'block', type: 'rtc_sensor' },
        { kind: 'block', type: 'ambient-sen' },
        { kind: 'block', type: 'LCD' },
        { kind: 'block', type: 'pressure' },
        { kind: 'block', type: 'compass' },
        { kind: 'block', type: 'ceprom' },
        { kind: 'block', type: 'gusture' },
        { kind: 'block', type: 'ir_temp' },
        { kind: 'block', type: 'motor_driver' },
        { kind: 'block', type: 'nfc_reader' },
        { kind: 'block', type: 'mag_encoder' },
        { kind: 'block', type: 'rfc' },
        { kind: 'block', type: 'text_speech' },
        { kind: 'block', type: 'uv_sensor' },
        { kind: 'block', type: 'temp_sensor' },
        { kind: 'block', type: 'accelerometer' },
        { kind: 'block', type: 'max' },
        { kind: 'block', type: 'seven_segment' },
        { kind: 'block', type: 'gas_sensor' },
        { kind: 'block', type: 'lifi_receiver' },
        { kind: 'block', type: 'lifi_transmitter' },
        { kind: 'block', type: 'touch_potentiometer' },
        { kind: 'block', type: 'fm_receiver' },
        { kind: 'block', type: 'gsr_skin_current_sensor' },
        { kind: 'block', type: 'line_follower' },


      ]
    },

    // ── PWM ──────────────────────────────────────────────────────────
    {
      kind: 'category', name: 'PWM', colour: '#F6EEDC', id: 'cat_pwm', contents: [
        { kind: 'block', type: 'bike_model' },
        { kind: 'block', type: 'do_dc_motor' },
        { kind: 'block', type: 'do_servo' },
        { kind: 'block', type: 'do_dc_motor2' },
      ]
    },

    // ── LEDS ─────────────────────────────────────────────────────────
    {
      kind: 'category', name: 'LEDs', colour: '#DBF3E7', id: 'cat_leds', contents: [
        { kind: 'block', type: 'do_led_param' },
        { kind: 'block', type: 'do_led' },
        { kind: 'block', type: 'red_led' },
        { kind: 'block', type: 'yellow_led' },
        { kind: 'block', type: 'light_freq' },
        { kind: 'block', type: 'green_led' },
        { kind: 'block', type: 'rgb_display' },
        { kind: 'block', type: 'rgb_led_display' },
        { kind: 'block', type: 'rgb_component' },
        { kind: 'block', type: 'LCD_print' },
      ]
    },

    // ── TX-RX ─────────────────────────────────────────────────────────
    {
      kind: 'category', name: 'Tx-Rx', colour: '#DEEAFB', id: 'cat_txrx', contents: [
        { kind: 'block', type: 'finger_print_enroll' },
        { kind: 'block', type: 'finger_print_match' },
        { kind: 'block', type: 'keypad' },
        { kind: 'block', type: 'gps' },
        { kind: 'block', type: 'gsm' },
        { kind: 'block', type: 'tof' },
        { kind: 'block', type: 'soli_npk' },
      ]
    },

    // ── AI BLOCKS (original dark-red category — always visible) ──────
    {
      kind: 'category', name: 'AI blocks', colour: '#F6E2E7', id: 'cat_ai_blocks',
      contents: [
        { kind: 'block', type: 'ai_block' },
        { kind: 'block', type: 'ai_output' },
        { kind: 'block', type: 'object_de' },
        { kind: 'block', type: 'object_out' },
      ]
    },

    // ── A.I. VISION — hidden until a board is picked via Extension →
    // board.html. Inserted dynamically as "<BOARD> AI Vision" by
    // setSelectedBoard() in js/main/cross-page-integration-1.js once K230/S3 is selected.

    // ── SPI ──────────────────────────────────────────────────────────
    {
      kind: 'category', name: 'SPI', colour: '#F5E3EF', id: 'cat_spi', contents: [
        { kind: 'block', type: 'rfid' },
        { kind: 'block', type: 'tft' },
      ]
    },

    // ── LOOP ─────────────────────────────────────────────────────────
    {
      kind: 'category', name: 'Loop', colour: '#E3E6FA', id: 'cat_loop', contents: [
        { kind: 'block', type: 'lp_while' },
        { kind: 'block', type: 'lp_break' },
        { kind: 'block', type: 'lp_continue' },
        { kind: 'block', type: 'lp_start' },
        { kind: 'block', type: 'lp_repeat_count' },
        { kind: 'block', type: 'lp_label' },
        { kind: 'block', type: 'compare' },
        {
          kind: 'block', type: 'controls_repeat_ext', inputs: {
            TIMES: { shadow: { type: 'math_number', fields: { NUM: '5' } } }
          }
        },
        {
          kind: 'block', type: 'controls_for', fields: { VAR: 'i' }, inputs: {
            FROM: { shadow: { type: 'math_number', fields: { NUM: '0' } } },
            TO: { shadow: { type: 'math_number', fields: { NUM: '10' } } }
          }
        },
      ]
    },

    // ── DELAY ────────────────────────────────────────────────────────
    {
      kind: 'category', name: 'Delay', colour: '#F7ECE3', id: 'cat_delay', contents: [
        { kind: 'block', type: 'ctl_delay' },
      ]
    },
    {
      kind: 'category', name: 'Llm', colour: '#D8EFF9', id: 'cat_llm', contents: [
        { kind: 'block', type: 'llm_text' },
      ]
    },
    { kind: 'sep' },

    // ── LOGIC ────────────────────────────────────────────────────────
    {
      kind: 'category', name: 'Logic', colour: '#D7F1F7', id: 'cat_logic', contents: [
        { kind: 'block', type: 'start' },
        {
          kind: 'block', type: 'controls_if', fields: { BOOL: 'TRUE' }
        },
        { kind: 'block', type: 'din_if_else' },
        { kind: 'block', type: 'logic_operation', fields: { OP: 'AND' } },
        { kind: 'block', type: 'logic_boolean', fields: { BOOL: 'TRUE' } },
        { kind: 'block', type: 'logical_comparison' },
        { kind: 'block', type: 'any_input_block' },
        { kind: 'block', type: 'custom_if_then' },
        { kind: 'block', type: 'system_status' },
        {
          kind: 'block', type: 'logic_compare', fields: { OP: 'EQ' }, inputs: {
            A: { shadow: { type: 'math_number', fields: { NUM: '10' } } },
            B: { shadow: { type: 'math_number', fields: { NUM: '5' } } }
          }
        },

      ]
    },

    // ── MATHS ────────────────────────────────────────────────────────
    {
      kind: 'category', name: 'Maths', colour: '#E7F4DE', id: 'cat_maths', contents: [
        { kind: 'block', type: 'math_number', fields: { NUM: '1' } },
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_join' },
        {
          kind: 'block', type: 'math_arithmetic', fields: { OP: 'ADD' }, inputs: {
            A: { shadow: { type: 'math_number', fields: { NUM: '1' } } },
            B: { shadow: { type: 'math_number', fields: { NUM: '2' } } }
          }
        },
        {
          kind: 'block', type: 'math_random_int', inputs: {
            FROM: { shadow: { type: 'math_number', fields: { NUM: '1' } } },
            TO: { shadow: { type: 'math_number', fields: { NUM: '100' } } }
          }
        },
      ]
    },

    // ── FUNCTION / VARIABLE / LIST ────────────────────────────────────
    { kind: 'category', name: 'Function', custom: 'PROCEDURE', colour: '#F5E2E4', id: 'cat_functions' },
    { kind: 'category', name: 'Variable', custom: 'VARIABLE', colour: '#F4F1DD', id: 'cat_variables' },
    { kind: 'category', name: 'List', custom: 'LIST', colour: '#C9EDE4', id: 'cat_lists' },

    { kind: 'sep' },

    // ── DISPLAY-3.js ─────────────────────────────────────────────────
    {
      kind: 'category', name: 'Display-3.js', colour: '#D8EFF9', id: 'cat_3d', contents: [
        { kind: 'block', type: 'three_d_model' },
        { kind: 'block', type: 'speedo_3d' },
        { kind: 'block', type: 'sim_solar' },
        { kind: 'block', type: 'sim_pendulum' },
        { kind: 'block', type: 'sim_particles' },
        { kind: 'block', type: 'sim_dna' },
        { kind: 'block', type: 'sim_gears' },
        { kind: 'block', type: 'sim_wave' },
        { kind: 'block', type: 'sim_bouncing' },
        { kind: 'block', type: 'sim_windmill' },
        { kind: 'block', type: 'sim_atom' },
        { kind: 'block', type: 'sim_globe' },
      ]
    },


    { kind: 'sep' },

    // ── DEFAULT BLOCK ────────────────────────────────────────────────
    {
      kind: 'category', name: 'default block', colour: '#ECEBFC', id: 'cat_default', contents: [
        { kind: 'block', type: 'math_number', fields: { NUM: '0' } },
        {
          kind: 'block', type: 'math_arithmetic', fields: { OP: 'ADD' }, inputs: {
            A: { shadow: { type: 'math_number', fields: { NUM: '1' } } },
            B: { shadow: { type: 'math_number', fields: { NUM: '2' } } }
          }
        },
        {
          kind: 'block', type: 'math_random_int', inputs: {
            FROM: { shadow: { type: 'math_number', fields: { NUM: '1' } } },
            TO: { shadow: { type: 'math_number', fields: { NUM: '100' } } }
          }
        },
        { kind: 'block', type: 'text', fields: { TEXT: 'Hello' } },
        {
          kind: 'block', type: 'text_join', inputs: {
            ADD0: { shadow: { type: 'text', fields: { TEXT: 'Hello' } } },
            ADD1: { shadow: { type: 'text', fields: { TEXT: 'World' } } }
          }
        },
        {
          kind: 'block', type: 'text_length', inputs: {
            VALUE: { shadow: { type: 'text', fields: { TEXT: 'Blockly' } } }
          }
        },
        {
          kind: 'block', type: 'variables_set', fields: { VAR: 'item' }, inputs: {
            VALUE: { shadow: { type: 'math_number', fields: { NUM: '10' } } }
          }
        },
        { kind: 'block', type: 'variables_get', fields: { VAR: 'item' } },
        {
          kind: 'block', type: 'controls_if', inputs: {
            IF0: { shadow: { type: 'logic_boolean', fields: { BOOL: 'TRUE' } } }
          }
        },
        {
          kind: 'block', type: 'controls_for', fields: { VAR: 'i' }, inputs: {
            FROM: { shadow: { type: 'math_number', fields: { NUM: '0' } } },
            TO: { shadow: { type: 'math_number', fields: { NUM: '10' } } }
          }
        },
        { kind: 'block', type: 'logic_boolean', fields: { BOOL: 'TRUE' } },
        {
          kind: 'block', type: 'logic_compare', fields: { OP: 'EQ' }, inputs: {
            A: { shadow: { type: 'math_number', fields: { NUM: '10' } } },
            B: { shadow: { type: 'math_number', fields: { NUM: '5' } } }
          }
        },
        { kind: 'block', type: 'logic_operation', fields: { OP: 'AND' } },
      ]
    },

  ]
};
