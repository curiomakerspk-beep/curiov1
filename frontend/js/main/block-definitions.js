// =====================================================================
// BLOCK DEFINITIONS
// =====================================================================
function defineBlocks() {
  Blockly.defineBlocksWithJsonArray([
    {
      "type": "list_variable_set",
      "message0": "set %1 to %2",
      "args0": [
        {
          "type": "field_variable",
          "name": "VAR",
          "variable": "%{BKY_VARIABLES_DEFAULT_NAME}",
          "variableTypes": ["list"],
          "defaultType": "list"
        },
        {
          "type": "input_value",
          "name": "VALUE"
        }
      ],
      "inputsInline": true,
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#0FB881",
      "extensions": ["list_color"]
    },
    {
      "type": "list_variable_get",
      "message0": "%1",
      "args0": [
        {
          "type": "field_variable",
          "name": "VAR",
          "variable": "%{BKY_VARIABLES_DEFAULT_NAME}",
          "variableTypes": ["list"],
          "defaultType": "list"
        }
      ],
      "output": null,
      "colour": "#0FB881",
      "extensions": ["list_color"]
    },
    { type: "sim_solar", message0: "%1 Solar System %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "Solar System" }], colour: "#f59e0b", previousStatement: null, nextStatement: null, extensions: ["sim_solar_click", "defult_style"] },
    { type: "sim_pendulum", message0: "%1 Pendulum %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "Pendulum" }], colour: "#ef4444", previousStatement: null, nextStatement: null, extensions: ["sim_pendulum_click", "defult_style"] },
    { type: "sim_particles", message0: "%1 Particles %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "Particles" }], colour: "#8b5cf6", previousStatement: null, nextStatement: null, extensions: ["sim_particles_click", "defult_style"] },
    { type: "sim_dna", message0: "%1 DNA Helix %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "DNA Helix" }], colour: "#06b6d4", previousStatement: null, nextStatement: null, extensions: ["sim_dna_click", "defult_style"] },
    { type: "sim_gears", message0: "%1 Gear System %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "Gear System" }], colour: "#64748b", previousStatement: null, nextStatement: null, extensions: ["sim_gears_click", "defult_style"] },
    { type: "sim_wave", message0: "%1 Wave Surface %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "Wave Surface" }], colour: "#0ea5e9", previousStatement: null, nextStatement: null, extensions: ["sim_wave_click", "defult_style"] },
    { type: "sim_bouncing", message0: "%1 Bouncing Balls %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "Bouncing Balls" }], colour: "#f97316", previousStatement: null, nextStatement: null, extensions: ["sim_bouncing_click", "defult_style"] },
    { type: "sim_windmill", message0: "%1 Wind Turbine %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "Wind Turbine" }], colour: "#22c55e", previousStatement: null, nextStatement: null, extensions: ["sim_windmill_click", "defult_style"] },
    { type: "sim_atom", message0: "%1 Atom Model %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "Atom Model" }], colour: "#a855f7", previousStatement: null, nextStatement: null, extensions: ["sim_atom_click", "defult_style"] },
    { type: "sim_globe", message0: "%1 Earth Globe %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "Earth Globe" }], colour: "#3b82f6", previousStatement: null, nextStatement: null, extensions: ["sim_globe_click", "defult_style"] },
    {
      type: "speedo_3d",
      message0: "%1 Speedometer %2 %3",
      args0: [
        { type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "Speedo", name: "IMG1", class: "hover-animate" },
        { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" },
        { type: "field_label", name: "SPEED_LABEL", text: "0%" }
      ],
      colour: "#10b981",
      previousStatement: null,
      nextStatement: null,
      extensions: ["speedo_3d_click", "defult_style"]
    },
    {
      type: "three_d_model",
      message0: "%1 3D Model %2 %3",
      args0: [
        {
          type: "field_image",
          src: "./assets/img/robo.png",
          width: 35,
          height: 35,
          alt: "3D",
          name: "IMG1",
          class: "hover-animate"
        },
        {
          type: "field_image",
          src: "./assets/img/Chips_Chips_Show.png",
          width: 15,
          height: 15,
          alt: "",
          name: "IMG",
          class: "hover-animate"
        },
        {
          type: "field_label",
          name: "MODEL_LABEL",
          text: "Cube"
        }
      ],
      colour: "#6366f1",
      previousStatement: null,
      nextStatement: null,
      extensions: ["three_d_image_click", "defult_style"]
    },
    {
      type: "start",
      message0: "Start %1 return %2",
      args0: [{
        type: "input_statement",
        name: "DO"
      },
      {
        type: "input_value"
        , name: "VALUE"
      }],
      nextStatement: null,
      extensions: ["logic_color"]
    },
    {
      type: "port_on",
      args0: [{
        type: "field_image",
        src: "./assets/img/robo.png",
        width: 35,
        height: 35,
        alt: "",
        name: "IMG1",
        class: "hover-animate"
      },
      {
        type: "field_label",
        name: "LABEL",
        text: "Digi ON"
      },
      {
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png"
        , width: 15,
        height: 15,
        alt: "",
        name: "IMG",
        class: "hover-animate"
      },
      {
        type: "field_label"
        , name: "PORTS",
        text: ""
      }],
      message0: "%1 %2 %3 %4",
      colour: "#ffb56a",
      previousStatement: null,
      nextStatement: null,
      extensions: ["port_on_img_click", "led_style"]
    },
    {
      type: "port_off",
      message0: "DigitalOut OFF %1 %2",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15,
        height: 15,
        alt: "",
        name: "IMG"
      },
      {
        type: "field_label",
        name: "PORTS",
        text: ""
      }
      ],
      colour: "#ffb56a",
      previousStatement: null,
      nextStatement: null,
      extensions: ["port_image_click", "led_style"]
    },
    {
      type: "rfid",
      message0: "RFID",

      colour: "#EB4899",
      output: "Boolean",
      extensions: ["spi_category_color"]
    },
    {
      type: "tft",
      message0: "TFT Display %1",
      args0: [
        {
          type: "input_value",
          name: "TEXT"
        }
      ],
      previousStatement: null,
      nextStatement: null,
      colour: "#EB4899",
      extensions: ["spi_category_color"]
    },
    {
      type: "finger_print_enroll",
      message0: "Fingerprint Enroll",

      colour: "#3B82F6",
      output: "Boolean",
      extensions: ["txrx_category_color"]
    },
    {
      type: "finger_print_match",
      message0: "Fingerprint Match ",

      colour: "#3B82F6",
      output: "Boolean",
      extensions: ["txrx_category_color"]
    },
    {
      type: "soli_npk",
      message0: "Soil Moisture NPK",

      colour: "#3B82F6",
      output: "Boolean",
      extensions: ["txrx_category_color"]
    },
    {
      type: "sen_ultrasonic",
      message0: "ultrasonic distance on port %1",
      args0: [{
        type: "field_number",
        name: "PORT",
        value: 2,
        min: 0,
        max: 99
      }],
      style: "control_blocks",
      previousStatement: null,
      nextStatement: null,
      extensions: ["led_style"]
    },
    { type: "sen_temp", message0: "temperature on port %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", previousStatement: null, nextStatement: null, extensions: ["led_style", "led_pin_image_click"] },
    { type: "do_onoff", message0: "digital write pins %1 %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["ON", "1"], ["OFF", "0"]] }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "servo_color"] },
    { type: "bike_model", message0: "🏍️ Bike Model %1 speed %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 18, height: 18, alt: "View", name: "IMG", class: "hover-animate" }, { type: "field_number", name: "BIKE_SPEED", value: 0, min: 0, max: 10 }, { type: "field_label", text: "/ 10" }], colour: "#F49E09", previousStatement: null, nextStatement: null, extensions: ["bike_model_image_click", "pwm_color"] },
    {
      type: "do_dc_motor",
      message0: "DC Motor %1 %2 speed %3 %4 %5",
      args0: [
        {
          type: "field_image", src: "./assets/img/Chips_Chips_Show.png",
          width: 15,
          height: 15,
          alt: "Config",
          name: "IMG",
          class: "hover-animate"
        },
        {
          type: "field_label",
          name: "MOTORS",
          text: ""
        },
        {
          type: "field_number",
          name: "SPEED",
          value: 60,
          min: 0,
          max: 100
        },
        {
          type: "field_label",
          text: "%"
        }, {
          type: "field_dropdown",
          name: "STATE",
          options:
            [["forward", "forward"],
            ["backward", "backward"],
            ["stop", "stop"]]
        }],
      colour: "#F49E09",
      previousStatement: null,
      nextStatement: null,
      extensions: ["motor_image_click", "pwm_color"]
    },
    {
      type: "do_dc_motor2",
      message0: "DC Motor %1 %2 %3",
      args0: [{
        type: "field_image",
        name: "IMG",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15, height: 15
      },
      {
        type: "field_label",
        name: "MOTORS", text: ""
      },
      {
        type: "field_dropdown",
        name: "STATE",
        options: [["forward", "forward"], ["backward", "backward"], ["stop", "stop"], ["turn left", "turn left"], ["turn right", "turn right"]]
      }], colour: "#F49E09", previousStatement: null, nextStatement: null, extensions: ["motor_image_click2", "pwm_color"]
    },
    { type: "do_servo", message0: "servo on %1 %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "SERVO_PORT", text: "" }, { type: "field_number", name: "ANG", value: 45, min: 0, max: 360, precision: 1 }], colour: "#F49E09", previousStatement: null, nextStatement: null, extensions: ["servo_image_click", "pwm_color"] },
    { type: "bt_send", message0: "Bluetooth send %1", args0: [{ type: "input_value", name: "TEXT" }], previousStatement: null, nextStatement: null, style: "control_blocks", extensions: ["servo_color"] },
    { type: "do_led", message0: "LED %1 %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["ON", "1"], ["OFF", "0"]] }], colour: "#22C45D", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "leds_category_color"] },
    { type: "ctl_delay", message0: "Delay%1 ms", args0: [{ type: "field_number", name: "MS", value: 500, min: 0, max: 600000 }], previousStatement: null, nextStatement: null, extensions: ["delay_color"] },
    { type: "lp_while", message0: "while %1", args0: [{ type: "input_value", name: "COND", check: "Boolean" }], message1: "do %1", args1: [{ type: "input_statement", name: "DO" }], previousStatement: null, nextStatement: null, extensions: ["dc_color"] },
    { type: "lp_break", message0: "break", previousStatement: null, nextStatement: null, extensions: ["dc_color"] },
    { type: "lp_continue", message0: "continue", previousStatement: null, nextStatement: null, extensions: ["dc_color"] },
    { type: "lp_start", message0: "@@start", previousStatement: null, nextStatement: null, extensions: ["dc_color"] },
    { type: "lp_repeat_count", message0: "repeat %1 %2 times", args0: [{ type: "field_number", name: "PIN" }, { type: "field_number", name: "COUNT", value: 4, min: 0, max: 100000 }], message1: "do %1", args1: [{ type: "input_statement", name: "DO" }], previousStatement: null, nextStatement: null, extensions: ["dc_color"] },
    { type: "lp_label", message0: "Print %1", args0: [{ type: "input_value", name: "NAME" }], previousStatement: null, nextStatement: null, extensions: ["dc_color"] },
    { type: "din_if_else", message0: "if %1", args0: [{ type: "input_value", name: "COND", check: "Boolean" }], message1: "do %1", args1: [{ type: "input_statement", name: "DO" }], message2: "else %1", args2: [{ type: "input_statement", name: "ELSE" }], previousStatement: null, nextStatement: null, extensions: ["logic_color"] },
    {
      type: "din_sound",
      message0: "SOUND CELL %1 %2",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15, height: 15, alt: "",
        name: "IMG"
      },
      { type: "field_label", name: "PORTS", text: "" }],
      style: "control_blocks",
      output: "Boolean",
      extensions: ["digital_style", "port_image_click"]
    },
    { type: "din_tilt", message0: "TILT %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["digital_style", "port_image_click"] },
    { type: "din_door", message0: "MAGNETIC SWITCH %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["digital_style", "port_image_click"] },
    { type: "din_button", message0: "BUTTON %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["digital_style", "port_image_click"] },
    { type: "din_motion", message0: "MOTION SENSOR %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["digital_style", "port_image_click"] },
    { type: "light_freq", message0: "LIGHT Frequency %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], colour: "#22C45D", output: "Boolean", extensions: ["leds_category_color", "port_image_click"] },
    { type: "din_proximity", message0: "PROXIMITY %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["digital_style", "port_image_click"] },
    { type: "din_ir", message0: "IR %1 %2 Value %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["0", "0"], ["1", "1"]] }], style: "control_blocks", output: "Boolean", extensions: ["digital_style", "ir_sensor_image_click"] },
    { type: "din_flame", message0: "FLAME %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["digital_style", "port_image_click"] },
    { type: "ana_flame", message0: "FLAME %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "port_image_click"] },
    { type: "load_cell", message0: "Load Cell %1 %2 Value %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["0", "0"], ["1", "1"]] }], style: "control_blocks", output: "Boolean", extensions: ["digital_style", "loadcell_image_click"] },
    { type: "do_led_param", message0: "LED write %1 %2 value %3 time %4", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_number", name: "VAL" }, { type: "field_number", name: "VAL2" }], colour: "#22C45D", previousStatement: null, nextStatement: null, extensions: ["led_pin_image_click", "leds_category_color"] },
    { type: "sensor", message0: "ultra sonic %1 %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["ON", "1"], ["OFF", "0"]] }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "ultra_style"] },
    { type: "tem_sensor", message0: "tem sonic %1 %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["ON", "1"], ["OFF", "0"]] }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "ultra_style"] },
    { type: "xray_sensor", message0: "xray sonic %1 %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["ON", "1"], ["OFF", "0"]] }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "ultra_style"] },
    { type: "rc_sensor", message0: "rc sensor %1 %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["ON", "1"], ["OFF", "0"]] }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "ultra_style"] },
    { type: "logical_comparison", message0: "%1 %2 %3", args0: [{ type: "input_value", name: "VALUE1" }, { type: "field_dropdown", name: "OPERATOR", options: [["<", "<"], [">", ">"], [" == ", "=="], [" >= ", ">="], [" <= ", "<="], [" != ", "!="]] }, { type: "input_value", name: "VALUE2" }], output: "Boolean", inputsInline: true, extensions: ["logic_color"] },
    { type: "red_led", message0: "Red LED %1 %2 %3 %4", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_number", name: "VAL1", value: 1, min: 0, max: 100, precision: 1 }, { type: "field_number", name: "VAL2", value: 1, min: 0, max: 100, precision: 1 }], colour: "#22C45D", previousStatement: null, nextStatement: null, extensions: ["led_pin_image_click", "leds_category_color"] },
    { type: "yellow_led", message0: "YELLOW LED %1 %2 %3 %4", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_number", name: "VAL1", value: 1, min: 0, max: 100, precision: 1 }, { type: "field_number", name: "VAL2", value: 1, min: 0, max: 100, precision: 1 }], colour: "#22C45D", previousStatement: null, nextStatement: null, extensions: ["led_pin_image_click", "leds_category_color"] },
    { type: "green_led", message0: "GREEN LED %1 %2 %3 %4", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_number", name: "VAL1", value: 1, min: 0, max: 100, precision: 1 }, { type: "field_number", name: "VAL2", value: 1, min: 0, max: 100, precision: 1 }], colour: "#22C45D", previousStatement: null, nextStatement: null, extensions: ["led_pin_image_click", "leds_category_color"] },
    { type: "water-turbidity-sensor", message0: "turbidity %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    { type: "steper", message0: "stepper Motor %1 %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_number", name: "SPEED", value: 60, min: 0, max: 100 }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "digital_style"] },
    { type: "waterpump", message0: "Water Pump %1 %2 Angle %3 °", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_number", name: "ANGLE", value: 60, min: 0 }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["waterpump_image_click", "digital_style"] },
    { type: "solinoid", message0: "Solinoid Valve %1 %2 Value %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["0", "0"], ["1", "1"]] }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "digital_style"] },
    { type: "animo", message0: "Anemo Meter %1 %2 Value %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["0", "0"], ["1", "1"]] }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "digital_style"] },
    { type: "relay", message0: "Relay %1 %2 Value %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["0", "0"], ["1", "1"]] }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["relay_switch_image_click", "digital_style"] },
    { type: "loop_end", message0: "End the Loop %1", args0: [{ type: "field_input", name: "NAME", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "port_image_click"] },
    { type: "buzzer", message0: "buzzer %1 %2 %3 %4 %5", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_number", name: "VAL1" }, { type: "field_number", name: "VAL2" }, { type: "field_number", name: "VAL3" }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "digital_style"] },
    { type: "minifan", message0: "Mini fan %1 %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["forward", "forward"], ["backward", "backward"], ["stop", "stop"]] }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["minifan_image_click", "digital_style"] },
    {
      type: "rgb_component",
      message0: "rgb_component %1 %2 %3 %4 %5",
      args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" },
      { type: "field_label", name: "PORTS", text: "" },
      { type: "field_number", name: "freq", value: 0 },
      { type: "field_number", name: "Delay1", value: 255 },
      { type: "field_number", name: "DELAY2", value: 0 }],
      colour: "#22C45D",
      previousStatement: null,
      nextStatement: null,
      extensions: ["port_image_click", "leds_category_color"]
    },
    { type: "shock_sensor", message0: "Shock Sensor %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "flex-sensor", message0: "flex %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    { type: "humidity", message0: "Huminity %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    {
      type: "piezo_sensor",
      message0: "Piezo %1 %2 ",
      args0: [
        {
          type: "field_image",
          src: "./assets/img/Chips_Chips_Show.png",
          width: 15,
          height: 15,
          alt: "",
          name: "IMG"
        },
        {
          type: "field_label",
          name: "PORTS",
          text: ""
        },

      ],
      output: "Boolean",
      extensions: ["led_pin_image_click", "temp_style"]
    },

    { type: "buzzer_component", message0: "buzzer_component %1 %2 %3 %4 %5", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_number", name: "freq" }, { type: "field_number", name: "Delay1" }, { type: "field_number", name: "DELAY2" }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "digital_style"] },
    { type: "joystick_move", args0: [{ type: "field_label", name: "LABEL", text: "joystick" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "PORTS", text: "" }], message0: "%1 %2 %3", colour: "#ffb56a", output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    { type: "Air_quality_sensor", message0: "Air-quality-sensor %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "flexi_force_sensor", message0: "Flexi Force Sensor %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "TDS_Water_sensor", message0: "TDS Water Sensor %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "LCD_print", message0: "LCD %1", args0: [{ type: "input_value", name: "TEXT" }], previousStatement: null, nextStatement: null, colour: "#22C45D", extensions: ["leds_category_color"] },
    { type: "din_temp", message0: "temperature sensor pin %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "water_sensor", message0: "Water Sensor %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "any_input_block", message0: "%1", args0: [{ type: "field_input", name: "ANY", text: "1" }], output: null, extensions: ["logic_color"] },
    { type: "custom_if_then", message0: "if %1 then %2", args0: [{ type: "input_value", name: "CONDITION", check: "Boolean" }, { type: "input_statement", name: "DO" }], previousStatement: null, nextStatement: null, extensions: ["logic_color"] },
    { type: "tep_ana", message0: "Temputure ana Sensor %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "heart_beat", message0: "heart beat %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "ldr", message0: "LDR %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "soil_moisture", message0: "Soil Moisture %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "soil_moisture_image_click"] },
    { type: "dust", message0: "dust %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "vibration-switch-sensor", message0: "vibration %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    { type: "Current-sensor", message0: "Current %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    { type: "IR-Temp", message0: "IR Temp %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    { type: "temp2-sensor", message0: "temp01 %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    { type: "ecg", message0: "EGC %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "ana_temp", message0: "Analog Temputure %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "magnetic_sensor", message0: "Magnetic sensor pin", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "colour_sen", message0: "Colour", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "system_status", message0: "System Status Running", output: "Boolean", extensions: ["logic_color"] },
    { type: "accelerometer_sensor", message0: "Accelerometer sensor pin", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "rtc_sensor", message0: "Rtc sensor pin", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "LCD", message0: "LCD pin", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "pressure", message0: "Pressure pin", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "compass", message0: "compass", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "ceprom", message0: "ceprom", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    {
      type: "speaker",
      message0: "Speaker %1 %2",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15, height: 15, alt: "",
        name: "IMG"
      },
      { type: "field_label", name: "PORTS", text: "" }],
      style: "control_blocks",
      output: "Boolean",
      extensions: ["digital_style", "port_image_click"]
    },
    {
      type: "rotation_sensor",
      message0: "Rotation Sensor %1 %2",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15, height: 15, alt: "",
        name: "IMG"
      },
      { type: "field_label", name: "PORTS", text: "" }],
      style: "control_blocks",
      output: "Boolean",
      extensions: ["digital_style", "port_image_click"]
    },
    { type: "gsr_skin_current_sensor", message0: "GSR Skin Current Sensor", style: "control_blocks", output: "Boolean", extensions: ["digital_style"] },
    { type: "line_follower", message0: "Line Follower", style: "control_blocks", output: "Boolean", extensions: ["digital_style"] },

    { type: "gusture", message0: "Gesture", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "ir_temp", message0: "IR temp", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "motor_driver", message0: "Motor Driver", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "nfc_reader", message0: "NFC Reader", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "mag_encoder", message0: "Mag Encoder", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "text_speech", message0: "Text Speech", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "rfc", message0: "RFC", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "touch_sensor", message0: "Touch Sensor", style: "control_blocks", output: "Boolean", extensions: ["digital_style"] },
    { type: "uv_sensor", message0: "UV Sensor", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "temp_sensor", message0: "Temp Sensor", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "accelerometer", message0: "Accelerometer", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "ir_sen", message0: "IR Sensor %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["digital_style", "port_image_click"] },
    {
      type: "max",
      message0: "Max",

      style: "control_blocks",
      output: "Boolean",
      extensions: ["i2c_style"]
    },
    {
      type: "water_level",
      message0: "Water Level %1 %2",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15, height: 15, alt: "",
        name: "IMG"
      },
      { type: "field_label", name: "PORTS", text: "" }],
      style: "control_blocks",
      output: "Boolean",
      extensions: ["temp_style", "led_pin_image_click"]
    },
    {
      type: "solor_panel",
      message0: "Solar Panel %1 %2",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15, height: 15, alt: "",
        name: "IMG"
      },
      { type: "field_label", name: "PORTS", text: "" }],
      style: "control_blocks",
      output: "Boolean",
      extensions: ["temp_style", "led_pin_image_click"]
    },
    {
      type: "admp",
      message0: "ADMP 401 %1 %2",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15, height: 15, alt: "",
        name: "IMG"
      },
      { type: "field_label", name: "PORTS", text: "" }],
      style: "control_blocks",
      output: "Boolean",
      extensions: ["temp_style", "led_pin_image_click"]
    },
    {
      type: "uv_sensor_ana",
      message0: "UV Sensor Analog %1 %2",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15, height: 15, alt: "",
        name: "IMG"
      },
      { type: "field_label", name: "PORTS", text: "" }],
      style: "control_blocks",
      output: "Boolean",
      extensions: ["temp_style", "led_pin_image_click"]
    },
    {
      type: "ph_sensor",
      message0: "PH sensor %1 %2",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15, height: 15, alt: "",
        name: "IMG"
      },
      { type: "field_label", name: "PORTS", text: "" }],
      style: "control_blocks",
      output: "Boolean",
      extensions: ["temp_style", "led_pin_image_click"]
    },



    { type: "uv_sensor_dig", message0: "UV Sensor Digital", style: "control_blocks", output: "Boolean", extensions: ["temp_style"] },
    { type: "seven_segment", message0: "Seven segment", style: "control_blocks", output: "Boolean", extensions: ["temp_style"] },
    { type: "gas_sensor", message0: 'gas sensor', style: "control_blocks", output: "Boolean", extensions: ["temp_style"] },
    { type: "lifi_receiver", message0: 'Lifi receiver', style: "control_blocks", output: "Boolean", extensions: ["temp_style"] },
    { type: "lifi_transmitter", message0: 'Lifi transmitter', style: "control_blocks", output: "Boolean", extensions: ["temp_style"] },
    { type: "touch_potentiometer", message0: 'Touch Potentiometer', style: "control_blocks", output: "Boolean", extensions: ["temp_style"] },
    { type: "fm_receiver", message0: 'FM Receiver', style: "control_blocks", output: "Boolean", extensions: ["temp_style"] },
    {
      type: "touch_sensor",
      message0: "TOUCH SENSOR %1 %2",
      args0: [
        {
          type: "field_image",
          src: "./assets/img/Chips_Chips_Show.png",
          width: 15,
          height: 15,
          alt: "",
          name: "IMG"
        },
        {
          type: "field_label",
          name: "PORTS",
          text: ""
        }
      ],
      colour: "#81d4ed",
      output: "Boolean",
      extensions: ["port_image_click", "servo_color"]
    },
    {
      type: "peltier",
      message0: "Peltier %1 %2 %3",
      args0: [
        {
          type: "field_image",
          src: "./assets/img/Chips_Chips_Show.png",
          width: 15,
          height: 15,
          alt: "",
          name: "IMG"
        },
        {
          type: "field_label",
          name: "PORTS",
          text: ""
        },
        {
          type: "field_dropdown",
          name: "STATE",
          options: [
            ["hot", "hot"],
            ["cold", "cold"],
            ["off", "off"]
          ]
        }
      ],
      colour: "#81d4ed",
      previousStatement: null,
      nextStatement: null,
      extensions: ["port_image_click", "ultra_style"]
    },
    {
      type: "microwave_sensor",
      message0: "Microwave_sensor %1 %2",
      args0: [
        {
          type: "field_image",
          src: "./assets/img/Chips_Chips_Show.png",
          width: 15,
          height: 15,
          alt: "",
          name: "IMG"
        },
        {
          type: "field_label",
          name: "PORTS",
          text: ""
        }],
      style: "control_blocks",
      output: "Boolean",
      extensions: ["temp_style", "port_image_click"]
    }
    ,
    { type: "ambient-sen", message0: "Ambient sensor pin", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "din_ultra", message0: "Ultra Sonic sensor pin %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    { type: "voltage_sensor", message0: "Voltage Sensor %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    { type: "rgb_display", message0: "display %1 %2 %3 %4 %5", args0: [{ type: "field_colour", name: "RED", colour: "#FF0000" }, { type: "field_colour", name: "ORANGE", colour: "#FFA500" }, { type: "field_colour", name: "YELLOW", colour: "#FFFF00" }, { type: "field_colour", name: "GREEN", colour: "#008000" }, { type: "field_colour", name: "CYAN", colour: "#00FFFF" }], colour: "#22C45D", previousStatement: null, nextStatement: null, extensions: ["leds_category_color"] },
    {
      type: "rgb_led_display",
      message0: "%1 LED %2 displays %3 for %4 secs",
      args0: [{
        type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG"
      },
      { type: "field_dropdown", name: "LED", options: [["all", "ALL"], ["1", "1"], ["2", "2"], ["3", "3"]] },
      { type: "field_rgb_picker", name: "COLOR", colour: "#ff0000" },
      { type: "input_value", name: "TIME", check: "Number" }],
      previousStatement: null,
      nextStatement: null,
      colour: "#22C45D",
      extensions: ["leds_category_color"]
    },
    {
      type: "din_ultra_range",
      message0: "Ultra Sonic range pin %1 %2 From %3 to %4 Range %5",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15,
        height: 15,
        alt: "", name: "IMG"
      },
      { type: "field_label", name: "PORTS", text: "" },
      { type: "field_number", name: "ANG1", value: "0" },
      { type: "field_number", name: "ANG2", value: "5" },
      {
        type: "field_dropdown",
        name: "STATE",
        options: [["0", "0"],
        ["1", "1"],
        ["2", "2"],
        ["3", "3"],
        ["4", "4"],
        ["5", "5"],
        ["6", "6"],
        ["7", "7"],
        ["8", "8"],
        ["9", "9"],
        ["10", "10"],]
      }],
      colour: "#C0603E",
      output: "Boolean",
      extensions: ["led_pin_image_click", "temp_style"]
    },
    {
      type: "keypad",
      message0: "Keypad %1 %2",
      args0: [
        {
          type: "field_image",
          src: "./assets/img/Chips_Chips_Show.png",
          width: 15,
          height: 15,
          alt: "",
          name: "IMG"
        },
        {
          type: "field_label",
          name: "PORTS",
          text: ""
        }],
      colour: "#3B82F6",
      previousStatement: null,
      nextStatement: null,
      extensions: ["txrx_category_color", "key_pin_image_click"]
    },
    {
      type: "gps",
      message0: "GPS ",

      colour: "#3B82F6",
      output: "Boolean",
      extensions: ["txrx_category_color"]
    },
    {
      type: "gsm",
      message0: "GSM %1 %2",
      args0: [
        {
          type: "field_input",
          name: "VAL1",
        },
        {
          type: "field_input",
          name: "VAL2",
        },],
      colour: "#3B82F6",
      previousStatement: null,
      nextStatement: null,
      extensions: ["port_image_click", "txrx_category_color"]
    },
    {
      type: "tof",
      message0: "ToF",

      colour: "#3B82F6",
      output: "Boolean",
      extensions: ["txrx_category_color"]
    },
    {
      type: "compare",
      message0: "RDX %1 %2",
      args0: [{
        type: "input_value",
        name: "NAME",
      },
      {
        type: "input_value",
        name: "NAME2",
      }],
      previousStatement: null,
      nextStatement: null,
      extensions: ["dc_color"]
    },
    {
      type: "llm_text",
      message0: "LLM TTS %1 %2 %3",
      args0: [
        {
          type: "input_value",
          name: "NAME2",
        },
        {
          type: "field_dropdown",
          name: "STATE",
          options: [["photo", "photo"],
          ["voice", "voice"],
          ["text", "text"]
          ]
        },
        {
          type: "field_input",
          name: "VAL1",
        },
      ],
      previousStatement: null,
      nextStatement: null,
      extensions: ["llm_color"]
    },
    // ── Original AI Blocks (dropdown-based) ─────────────────────────
    {
      type: "ai_block",
      message0: "Ai Blocks %1",
      args0: [{
        type: "field_dropdown",
        name: "STATE", options: [
          ["Face Detection", "face_detection"],
          ["Color Detection", "color_detection"],
          ["Multi color Recognition", "multi_color_recognition"],
          ["Same Color Object counting", "same_color_object_counting"],
          ["QR Code Recognition", "qr_code_recognition"],
          ["Live Camera", "live_camera"],
          ["Train", "Train"]]
      }],
      colour: "#FF69B4",
      previousStatement: null,
      nextStatement: null,
      extensions: ["servo_color"]
    },
    {
      type: "ai_output",
      message0: "Ai Output %1",
      args0: [{
        type: "field_dropdown",
        name: "STATE", options: [
          ["Face Detection", "face_detection"],
          ["Color Detection", "color_detection"],
          ["Multi color Recognition", "multi_color_recognition"],
          ["Same Color Object counting", "same_color_object_counting"],
          ["QR Code Recognition", "qr_code_recognition"],
          ["Live Camera", "live_camera"],
          ["Train", "Train"]]
      }],
      colour: "#FF69B4",
      output: "Boolean",
      extensions: ["servo_color"]
    },
    {
      type: "object_de",
      message0: "Object Detection %1",
      args0: [{
        type: "field_dropdown",
        name: "STATE", options: [
          ["Person", "person"], ["Bicycle", "bicycle"], ["Car", "car"],
          ["Motorcycle", "motorcycle"], ["Airplane", "airplane"], ["Bus", "bus"],
          ["Train", "train"], ["Truck", "truck"], ["Boat", "boat"],
          ["Traffic light", "traffic_light"], ["Sports Ball", "sports_ball"],
          ["Cup", "cup"], ["Toothbrush", "toothbrush"],
          ["Book", "book"], ["Keyboard", "keyboard"]]
      }],
      colour: "#FF69B4",
      previousStatement: null,
      nextStatement: null,
      extensions: ["servo_color"]
    },
    {
      type: "object_out",
      message0: "Object Output %1",
      args0: [{
        type: "field_dropdown",
        name: "STATE", options: [
          ["Person", "person"], ["Bicycle", "bicycle"], ["Car", "car"],
          ["Motorcycle", "motorcycle"], ["Airplane", "airplane"], ["Bus", "bus"],
          ["Train", "train"], ["Truck", "truck"], ["Boat", "boat"],
          ["Traffic light", "traffic_light"], ["Sports Ball", "sports_ball"],
          ["Cup", "cup"], ["Toothbrush", "toothbrush"],
          ["Book", "book"], ["Keyboard", "keyboard"]]
      }],
      colour: "#FF69B4",
      output: "Boolean",
      extensions: ["servo_color"]
    },

    // ── A.I. Vision Blocks ───────────────────────────────────────────
    {
      type: 'ai_open_train',
      message0: '🤖 Open AI Training Studio',
      args0: [],
      colour: '#7c3aed',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Open the AI camera training screen to train your model.',
      helpUrl: '',
      extensions: ["temp_style"]
    },
    {
      type: 'ai_export_model',
      message0: '📤 Export AI Model to Board',
      args0: [],
      colour: '#0ea5e9',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Export the trained AI model to the connected board.',
      helpUrl: '',
      extensions: ["defult_style"]
    },
    {
      type: 'ai_open_train_k230',
      message0: 'K230: 🤖 Open AI Training Studio',
      args0: [],
      colour: '#7c3aed',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Open the K230 AI camera training screen to train your model.',
      helpUrl: '',
      extensions: ["temp_style"]
    },
    {
      type: 'ai_open_train_s3',
      message0: 'S3: 🤖 Open AI Training Studio',
      args0: [],
      colour: '#7c3aed',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Open the S3 AI camera training screen to train your model.',
      helpUrl: '',
      extensions: ["temp_style"]
    },
    {
      type: 'ai_export_model_k230',
      message0: 'K230: 📤 Export AI Model to Board',
      args0: [],
      colour: '#0ea5e9',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Export the trained AI model to the connected K230 board.',
      helpUrl: '',
      extensions: ["defult_style"]
    },
    {
      type: 'ai_export_model_s3',
      message0: 'S3: 📤 Export AI Model to Board',
      args0: [],
      colour: '#0ea5e9',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Export the trained AI model to the connected S3 board.',
      helpUrl: '',
      extensions: ["defult_style"]
    },
    {
      type: 'ai_infer_k230',
      message0: '🧠 K230: Run AI Inference',
      args0: [],
      colour: '#f54254',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Trigger the AI inference loop on the K230 KPU.',
      helpUrl: '',
      extensions: ["led_style"]
    },
    {
      type: 'ai_infer_s3',
      message0: '🧠 S3: Run AI Inference',
      args0: [],
      colour: '#f54254',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Trigger the AI inference loop on the S3 board.',
      helpUrl: '',
      extensions: ["led_style"]
    },
    {
      type: 'ai_classify_image',
      message0: 'classify image → result %1',
      args0: [{
        type: 'field_dropdown',
        name: 'CLASS',
        options: [['Class1', 'Class1'], ['Class2', 'Class2']]
      }],
      colour: '#f54254',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Run AI classification on camera feed.',
      helpUrl: '',
      extensions: ["led_style"]
    },
    {
      type: 'ai_classify_image_k230',
      message0: 'K230: classify image → result %1',
      args0: [{
        type: 'field_dropdown',
        name: 'CLASS',
        options: [['Class1', 'Class1'], ['Class2', 'Class2']]
      }],
      colour: '#f54254',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Run AI classification on the K230 camera feed.',
      helpUrl: '',
      extensions: ["led_style"]
    },
    {
      type: 'ai_classify_image_s3',
      message0: 'S3: classify image → result %1',
      args0: [{
        type: 'field_dropdown',
        name: 'CLASS',
        options: [['Class1', 'Class1'], ['Class2', 'Class2']]
      }],
      colour: '#f54254',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Run AI classification on the S3 camera feed.',
      helpUrl: '',
      extensions: ["led_style"]
    },
    {
      type: 'ai_class_result',
      message0: 'classifying result is %1',
      args0: [{
        type: 'field_dropdown',
        name: 'CLASS',
        options: [['Class1', 'Class1'], ['Class2', 'Class2']]
      }],
      colour: '#7c3aed',
      output: 'Boolean',
      tooltip: 'Returns true if the camera sees this class.',
      helpUrl: '',
      extensions: ["temp_style"]
    },
    {
      type: 'ai_class_result_k230',
      message0: 'K230: classifying result is %1',
      args0: [{
        type: 'field_dropdown',
        name: 'CLASS',
        options: [['Class1', 'Class1'], ['Class2', 'Class2']]
      }],
      colour: '#7c3aed',
      output: 'Boolean',
      tooltip: 'Returns true if the K230 camera sees this class.',
      helpUrl: '',
      extensions: ["temp_style"]
    },
    {
      type: 'ai_class_result_s3',
      message0: 'S3: classifying result is %1',
      args0: [{
        type: 'field_dropdown',
        name: 'CLASS',
        options: [['Class1', 'Class1'], ['Class2', 'Class2']]
      }],
      colour: '#7c3aed',
      output: 'Boolean',
      tooltip: 'Returns true if the S3 camera sees this class.',
      helpUrl: '',
      extensions: ["temp_style"]
    },
    {
      type: 'ai_class_reliability',
      message0: 'reliability of %1',
      args0: [{
        type: 'field_dropdown',
        name: 'CLASS',
        options: [['Class1', 'Class1'], ['Class2', 'Class2']]
      }],
      colour: '#7c3aed',
      output: 'Number',
      tooltip: 'Returns 0–100 confidence score for this class.',
      helpUrl: '',
      extensions: ["temp_style"]
    },
    {
      type: 'ai_class_reliability_k230',
      message0: 'K230: reliability of %1',
      args0: [{
        type: 'field_dropdown',
        name: 'CLASS',
        options: [['Class1', 'Class1'], ['Class2', 'Class2']]
      }],
      colour: '#7c3aed',
      output: 'Number',
      tooltip: 'Returns 0–100 confidence score for this class on K230.',
      helpUrl: '',
      extensions: ["temp_style"]
    },
    {
      type: 'ai_class_reliability_s3',
      message0: 'S3: reliability of %1',
      args0: [{
        type: 'field_dropdown',
        name: 'CLASS',
        options: [['Class1', 'Class1'], ['Class2', 'Class2']]
      }],
      colour: '#7c3aed',
      output: 'Number',
      tooltip: 'Returns 0–100 confidence score for this class on S3.',
      helpUrl: '',
      extensions: ["temp_style"]
    },
  ]);

  // Extensions
  Blockly.Extensions.register('port_on_img_click', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openPortSelectionModal(this));
  });
  Blockly.Extensions.register('port_image_click', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openPortSelectionModal(this));
  });
  Blockly.Extensions.register('bike_model_image_click', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openBikeModelModal(this));
  });
  Blockly.Extensions.register('motor_image_click', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openUnifiedModal(this));
  });
  Blockly.Extensions.register('motor_image_click2', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openMotorSelectionModal(this));
  });
  Blockly.Extensions.register('minifan_image_click', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openMinifanSelectionModal(this));
  });
  Blockly.Extensions.register('ir_sensor_image_click', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openSensorModal('ir', this));
  });
  Blockly.Extensions.register('relay_switch_image_click', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openSensorModal('relay', this));
  });
  Blockly.Extensions.register('loadcell_image_click', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openSensorModal('loadcell', this));
  });
  Blockly.Extensions.register('waterpump_image_click', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openSensorModal('waterpump', this));
  });
  Blockly.Extensions.register('servo_image_click', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openServoSelectionModal(this));
  });
  Blockly.Extensions.register('led_pin_image_click', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openLedPinSelectionModal(this));
  });
  Blockly.Extensions.register('soil_moisture_image_click', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openSoilMoisturePopupModal(this));
  });
  Blockly.Extensions.register('key_pin_image_click', function () {
    const imgField = this.getField('IMG');
    if (!imgField) return;
    imgField.setOnClickHandler(() => {
      openkeyPinSelectionModal(this);
    });
  });

  Blockly.Extensions.register('three_d_image_click', function () {
    // Hidden fields to store 3D model config
    this.appendDummyInput('HIDDEN_3D')
      .appendField(new Blockly.FieldTextInput('cube'), 'MODEL_TYPE')
      .appendField(new Blockly.FieldTextInput('30'), 'SPIN_SPEED')
      .appendField(new Blockly.FieldTextInput('#7c3aed'), 'MODEL_COLOR')
      .setVisible(false);
    const f = this.getField('IMG');
    if (!f) return;
    f.setOnClickHandler(() => open3DModal(this));
  });


  Blockly.Extensions.register('speedo_3d_click', function () {
    this.appendDummyInput('HIDDEN_SPEEDO')
      .appendField(new Blockly.FieldTextInput('0'), 'SPEED_VAL')
      .setVisible(false);
    var f = this.getField('IMG');
    if (!f) return;
    f.setOnClickHandler(() => openSpeedo3D(this));
  });

  Blockly.Extensions.register('sim_solar_click', function () { this.appendDummyInput('H_SIM_SOLAR').appendField(new Blockly.FieldTextInput('sim_solar'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_solar')); });
  Blockly.Extensions.register('sim_pendulum_click', function () { this.appendDummyInput('H_SIM_PENDULUM').appendField(new Blockly.FieldTextInput('sim_pendulum'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_pendulum')); });
  Blockly.Extensions.register('sim_particles_click', function () { this.appendDummyInput('H_SIM_PARTICLES').appendField(new Blockly.FieldTextInput('sim_particles'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_particles')); });
  Blockly.Extensions.register('sim_dna_click', function () { this.appendDummyInput('H_SIM_DNA').appendField(new Blockly.FieldTextInput('sim_dna'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_dna')); });
  Blockly.Extensions.register('sim_gears_click', function () { this.appendDummyInput('H_SIM_GEARS').appendField(new Blockly.FieldTextInput('sim_gears'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_gears')); });
  Blockly.Extensions.register('sim_wave_click', function () { this.appendDummyInput('H_SIM_WAVE').appendField(new Blockly.FieldTextInput('sim_wave'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_wave')); });
  Blockly.Extensions.register('sim_bouncing_click', function () { this.appendDummyInput('H_SIM_BOUNCING').appendField(new Blockly.FieldTextInput('sim_bouncing'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_bouncing')); });
  Blockly.Extensions.register('sim_windmill_click', function () { this.appendDummyInput('H_SIM_WINDMILL').appendField(new Blockly.FieldTextInput('sim_windmill'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_windmill')); });
  Blockly.Extensions.register('sim_atom_click', function () { this.appendDummyInput('H_SIM_ATOM').appendField(new Blockly.FieldTextInput('sim_atom'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_atom')); });
  Blockly.Extensions.register('sim_globe_click', function () { this.appendDummyInput('H_SIM_GLOBE').appendField(new Blockly.FieldTextInput('sim_globe'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_globe')); });
  // Style extensions — apply class immediately AND on every change
  // so gradient stays consistent from the moment a block enters the workspace.
  function mkStyleExt(name, cls) {
    Blockly.Extensions.register(name, function () {
      const block = this;
      // Apply immediately (covers drag-from-flyout moment)
      function applyNow() {
        const root = (typeof block.getSvgRoot === 'function')
          ? block.getSvgRoot() : block.svgGroup_;
        if (root) {
          root.classList.add(cls);
          // Also trigger the full gradient fill immediately
          if (typeof applyGradientAndShadowToBlock === 'function') {
            applyGradientAndShadowToBlock(block);
          }
        }
      }
      // Try immediately; also retry after a frame in case SVG is not ready yet
      applyNow();
      requestAnimationFrame(applyNow);
      // Re-apply on any workspace change (resilience against Blockly re-renders)
      block.setOnChange(function () { applyNow(); });
    });
  }
  mkStyleExt('defult_style', 'defult_style');
  mkStyleExt('servo_color', 'block-servo');
  mkStyleExt('pwm_color', 'pwm_style');
  mkStyleExt('leds_category_color', 'led_category_style');
  mkStyleExt('txrx_category_color', 'txrx_category_style');
  mkStyleExt('spi_category_color', 'spi_category_style');
  mkStyleExt('led_style', 'led_style');
  mkStyleExt('dummy_style', 'dummy_block');
  mkStyleExt('delay_color', 'delay_style');
  mkStyleExt('logic_color', 'logic_style');
  mkStyleExt('llm_color', 'llm_style');
  mkStyleExt('list_color', 'list_style');
  mkStyleExt('temp_style', 'temp_style');
  mkStyleExt('i2c_style', 'i2c_style');
  mkStyleExt('digital_style', 'digital_style');
  mkStyleExt('dc_color', 'block_dc');
  mkStyleExt('ultra_style', 'ultra_style');
}

