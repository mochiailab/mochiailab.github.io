// Real component photos and where their pins are, in the photo's own pixels.
// crop = [x, y, w, h] part of the photo that is shown.
window.MOCHI_PARTS = {
  c3: { img: 'img/c3.jpg', crop: [120, 60, 590, 650], name: 'ESP32-C3 SuperMini',
    pins: {
      '5V': [178, 118], 'G': [178, 195], '3V3': [178, 272], '4': [178, 352], '3': [178, 430], '2': [178, 507], '1': [178, 586], '0': [178, 663],
      '5': [650, 118], '6': [650, 195], '7': [650, 272], '8': [650, 352], '9': [650, 430], '10': [650, 507], '20': [650, 586], '21': [650, 663] } },
  screen: { img: 'img/screen.jpg', crop: [160, 30, 560, 460], name: 'Màn ST7735S 0.96"',
    pins: { GND: [276, 66], VCC: [322, 66], SCL: [368, 66], SDA: [413, 66], RES: [459, 66], DC: [505, 66], CS: [551, 66], BLK: [597, 66] } },
  amp: { img: 'img/amp.jpg', crop: [20, 20, 510, 560], name: 'Ampli MAX98357A',
    pins: { LRC: [60, 513], BCLK: [125, 520], DIN: [193, 516], GAIN: [265, 516], SD: [338, 513], GND: [412, 516], VIN: [490, 513],
      'SPK-': [243, 128], 'SPK+': [308, 128] } },
  speaker: { img: 'img/speaker.jpg', crop: [90, 90, 400, 830], name: 'Loa',
    pins: { red: [292, 905], black: [300, 905] } },
  mic: { img: 'img/mic.jpg', crop: [330, 250, 440, 400], name: 'Mic INMP441',
    pins: { GND: [571, 331], VDD: [619, 377], SD: [667, 420], LR: [409, 463], WS: [459, 507], SCK: [511, 547] } },
  battery: { img: 'img/battery.jpg', crop: [300, 520, 500, 260], name: 'Pin 14250 3.7V',
    pins: { '+': [340, 650], '-': [770, 650] } },
  charger: { img: 'img/charger.jpg', crop: [200, 120, 1500, 1020], name: 'Mạch sạc Type-C',
    pins: { 'OUT-': [312, 663], 'B-': [387, 735], 'B+': [672, 905], 'OUT+': [776, 1010] } },
  switch: { img: 'img/switch.jpg', crop: [80, 0, 380, 411], name: 'Công tắc gạt',
    pins: { A: [118, 292], COM: [178, 322], B: [238, 290] } },
};
