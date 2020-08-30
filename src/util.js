import { Color } from 'rot-js/lib/index';


export class Util {
  static minGray = [30, 0, 0];
  static maxGray = [255, 180, 180];

  static wallColorMin = [50, 20, 20];
  static wallColorMax = [255, 200, 200];

  static key(x, y) {
    return x + "," + y
  }

  static parseKey(key) {
    let parts = key.split(",");
    let x = parseInt(parts[0]);
    let y = parseInt(parts[1]);
    return [x, y]
  }

  static grayscale(value) {
    if (value > 1.0)
      value = 1.0
    if (value < 0.0)
      value = 0.0
    return Color.toHex(Color.interpolate(Util.minGray, Util.maxGray, value))
  }

  static wallColor(value) {
    if (value > 1.0)
      value = 1.0
    if (value < 0.0)
      value = 0.0
    return Color.toHex(Color.interpolate(Util.wallColorMin, Util.wallColorMax, value))
  }
}
