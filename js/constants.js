var Calc = Calc || {};

Calc.constants = {};

// Sources:
// www.engineeringtoolbox.com/dry-air-properties-d_973.html
Calc.constants.air_properties = [ // For dry air
    { temperature: 175,  c_p: 1.0023, c_v: 0.7152, cp_cv: 1.401, mu: 1.182E-5, k: 1.593E-5, pr: 0.744, v: 0.586E-5, rho: 2.017  },
    { temperature: 200,  c_p: 1.0025, c_v: 0.7154, cp_cv: 1.401, mu: 1.329E-5, k: 1.809E-5, pr: 0.736, v: 0.753E-5, rho: 1.765  },
    { temperature: 225,  c_p: 1.0027, c_v: 0.7156, cp_cv: 1.401, mu: 1.467E-5, k: 2.02E-5,  pr: 0.728, v: 0.935E-5, rho: 1.569  },
    { temperature: 250,  c_p: 1.0031, c_v: 0.716,  cp_cv: 1.401, mu: 1.599E-5, k: 2.227E-5, pr: 0.72,  v: 1.132E-5, rho: 1.412  },
    { temperature: 275,  c_p: 1.0038, c_v: 0.7167, cp_cv: 1.401, mu: 1.725E-5, k: 2.428E-5, pr: 0.713, v: 1.343E-5, rho: 1.284  },
    { temperature: 300,  c_p: 1.0049, c_v: 0.7178, cp_cv: 1.4,   mu: 1.846E-5, k: 2.624E-5, pr: 0.707, v: 1.568E-5, rho: 1.177  },
    { temperature: 325,  c_p: 1.0063, c_v: 0.7192, cp_cv: 1.4,   mu: 1.962E-5, k: 2.816E-5, pr: 0.701, v: 1.807E-5, rho: 1.086  },
    { temperature: 350,  c_p: 1.0082, c_v: 0.7211, cp_cv: 1.398, mu: 2.075E-5, k: 3.003E-5, pr: 0.697, v: 2.056E-5, rho: 1.009  },
    { temperature: 375,  c_p: 1.0106, c_v: 0.7235, cp_cv: 1.397, mu: 2.181E-5, k: 3.186E-5, pr: 0.692, v: 2.317E-5, rho: 0.9413 },
    { temperature: 400,  c_p: 1.0135, c_v: 0.7264, cp_cv: 1.395, mu: 2.286E-5, k: 3.365E-5, pr: 0.688, v: 2.591E-5, rho: 0.8824 },
    { temperature: 450,  c_p: 1.0206, c_v: 0.7335, cp_cv: 1.391, mu: 2.485E-5, k: 3.71E-5,  pr: 0.684, v: 3.168E-5, rho: 0.7844 },
    { temperature: 500,  c_p: 1.0295, c_v: 0.7424, cp_cv: 1.387, mu: 2.67E-5,  k: 4.041E-5, pr: 0.68,  v: 3.782E-5, rho: 0.706  },
    { temperature: 550,  c_p: 1.0398, c_v: 0.7527, cp_cv: 1.381, mu: 2.849E-5, k: 4.357E-5, pr: 0.68,  v: 4.439E-5, rho: 0.6418 },
    { temperature: 600,  c_p: 1.0511, c_v: 0.764,  cp_cv: 1.376, mu: 3.017E-5, k: 4.661E-5, pr: 0.68,  v: 5.128E-5, rho: 0.5883 },
    { temperature: 650,  c_p: 1.0629, c_v: 0.7758, cp_cv: 1.37,  mu: 3.178E-5, k: 4.954E-5, pr: 0.682, v: 5.853E-5, rho: 0.543  },
    { temperature: 700,  c_p: 1.075,  c_v: 0.7879, cp_cv: 1.364, mu: 3.332E-5, k: 5.236E-5, pr: 0.684, v: 6.607E-5, rho: 0.5043 },
    { temperature: 750,  c_p: 1.087,  c_v: 0.7999, cp_cv: 1.359, mu: 3.482E-5, k: 5.509E-5, pr: 0.687, v: 7.399E-5, rho: 0.4706 },
    { temperature: 800,  c_p: 1.0987, c_v: 0.8116, cp_cv: 1.354, mu: 3.624E-5, k: 5.774E-5, pr: 0.69,  v: 8.214E-5, rho: 0.4412 },
    { temperature: 850,  c_p: 1.1101, c_v: 0.823,  cp_cv: 1.349, mu: 3.763E-5, k: 6.03E-5,  pr: 0.693, v: 9.061E-5, rho: 0.4153 },
    { temperature: 900,  c_p: 1.1209, c_v: 0.8338, cp_cv: 1.344, mu: 3.897E-5, k: 6.276E-5, pr: 0.696, v: 9.936E-5, rho: 0.3922 },
    { temperature: 950,  c_p: 1.1313, c_v: 0.8442, cp_cv: 1.34,  mu: 4.026E-5, k: 6.52E-5,  pr: 0.699, v: 10.83E-5, rho: 0.3716 },
    { temperature: 1000, c_p: 1.1411, c_v: 0.854,  cp_cv: 1.336, mu: 4.153E-5, k: 6.754E-5, pr: 0.702, v: 11.76E-5, rho: 0.353  },
    { temperature: 1050, c_p: 1.1502, c_v: 0.8631, cp_cv: 1.333, mu: 4.276E-5, k: 6.985E-5, pr: 0.704, v: 12.72E-5, rho: 0.3362 },
    { temperature: 1100, c_p: 1.1589, c_v: 0.8718, cp_cv: 1.329, mu: 4.396E-5, k: 7.209E-5, pr: 0.707, v: 13.7E-5,  rho: 0.3209 },
    { temperature: 1150, c_p: 1.167,  c_v: 0.8799, cp_cv: 1.326, mu: 4.511E-5, k: 7.427E-5, pr: 0.709, v: 14.7E-5,  rho: 0.3069 },
    { temperature: 1200, c_p: 1.1746, c_v: 0.8875, cp_cv: 1.323, mu: 4.626E-5, k: 7.64E-5,  pr: 0.711, v: 15.73E-5, rho: 0.2941 },
    { temperature: 1250, c_p: 1.1817, c_v: 0.8946, cp_cv: 1.321, mu: 4.736E-5, k: 7.849E-5, pr: 0.713, v: 16.77E-5, rho: 0.2824 },
    { temperature: 1300, c_p: 1.1884, c_v: 0.9013, cp_cv: 1.319, mu: 4.846E-5, k: 8.054E-5, pr: 0.715, v: 17.85E-5, rho: 0.2715 },
    { temperature: 1350, c_p: 1.1946, c_v: 0.9075, cp_cv: 1.316, mu: 4.952E-5, k: 8.253E-5, pr: 0.717, v: 18.94E-5, rho: 0.2615 },
    { temperature: 1400, c_p: 1.2005, c_v: 0.9134, cp_cv: 1.314, mu: 5.057E-5, k: 8.45E-5,  pr: 0.719, v: 20.06E-5, rho: 0.2521 },
    { temperature: 1500, c_p: 1.2112, c_v: 0.9241, cp_cv: 1.311, mu: 5.264E-5, k: 8.831E-5, pr: 0.722, v: 22.36E-5, rho: 0.2353 },
    { temperature: 1600, c_p: 1.2207, c_v: 0.9336, cp_cv: 1.308, mu: 5.457E-5, k: 9.199E-5, pr: 0.724, v: 24.74E-5, rho: 0.2206 },
    { temperature: 1700, c_p: 1.2293, c_v: 0.9422, cp_cv: 1.305, mu: 5.646E-5, k: 9.554E-5, pr: 0.726, v: 27.2E-5,  rho: 0.2076 },
    { temperature: 1800, c_p: 1.237,  c_v: 0.9499, cp_cv: 1.302, mu: 5.829E-5, k: 9.899E-5, pr: 0.728, v: 29.72E-5, rho: 0.1961 },
    { temperature: 1900, c_p: 1.244,  c_v: 0.9569, cp_cv: 1.3,   mu: 6.008E-5, k: 10.233E-5,pr: 0.73,  v: 32.34E-5, rho: 0.1858 }
];

// Sources:
// www.engineeringtoolbox.com/relative-humidity-air-d_687.html
Calc.constants.vapor_saturation_pressures = [
    { temperature: 258.15, p_sat_mb: 1.5,   p_sat_kpa: 0.15  },
    { temperature: 261.15, p_sat_mb: 1.9,   p_sat_kpa: 0.19  },
    { temperature: 264.15, p_sat_mb: 2.4,   p_sat_kpa: 0.24  },
    { temperature: 266.15, p_sat_mb: 3,     p_sat_kpa: 0.30  },
    { temperature: 269.15, p_sat_mb: 3.7,   p_sat_kpa: 0.37  },
    { temperature: 272.15, p_sat_mb: 4.6,   p_sat_kpa: 0.46  },
    { temperature: 275.15, p_sat_mb: 5.6,   p_sat_kpa: 0.56  },
    { temperature: 277.15, p_sat_mb: 6.9,   p_sat_kpa: 0.69  },
    { temperature: 280.15, p_sat_mb: 8.4,   p_sat_kpa: 0.84  },
    { temperature: 283.15, p_sat_mb: 10.3,  p_sat_kpa: 1.03  },
    { temperature: 286.15, p_sat_mb: 12.3,  p_sat_kpa: 1.23  },
    { temperature: 289.15, p_sat_mb: 14.8,  p_sat_kpa: 1.48  },
    { temperature: 291.15, p_sat_mb: 17.7,  p_sat_kpa: 1.77  },
    { temperature: 294.15, p_sat_mb: 21,    p_sat_kpa: 2.10  },
    { temperature: 297.15, p_sat_mb: 25,    p_sat_kpa: 2.50  },
    { temperature: 300.15, p_sat_mb: 29.6,  p_sat_kpa: 2.96  },
    { temperature: 302.15, p_sat_mb: 35,    p_sat_kpa: 3.50  },
    { temperature: 305.15, p_sat_mb: 41,    p_sat_kpa: 4.10  },
    { temperature: 308.15, p_sat_mb: 48.1,  p_sat_kpa: 4.81  },
    { temperature: 311.15, p_sat_mb: 56.2,  p_sat_kpa: 5.62  },
    { temperature: 314.15, p_sat_mb: 65.6,  p_sat_kpa: 6.56  },
    { temperature: 316.15, p_sat_mb: 76.2,  p_sat_kpa: 7.62  },
    { temperature: 319.15, p_sat_mb: 87.8,  p_sat_kpa: 8.78  },
    { temperature: 322.15, p_sat_mb: 101.4, p_sat_kpa: 10.14 },
    { temperature: 325.15, p_sat_mb: 116.8, p_sat_kpa: 11.68 }
];

// Sources: 
// www.thegreenage.co.uk/getting-to-grips-with-u-values
// www.kingspaninsulation.co.uk/Products/Kooltherm/Kooltherm-K18-Insulated-Plasterboard/Overview.aspx
Calc.constants.wall_types = { // Set of U-values for wall constructions, in W/m^2K
    brick_305:      1.3,
    brick_9:        4.3,
    cav_empty:      1.6,
    cav_filled:     0.45,
    brick_9_w_k18:  0.28
};

// Sources:
// www.buildingconservation.com/articles/secondary-glazing/secondary-glazing.htm
// www.bre.co.uk/page.jsp?id=3388
Calc.constants.window_types = { // Set of U-values for window constructions, in W/m^2K
    single:     5.4,
    double:     1.9,
    triple:     0.6,
    secondary:  1.7
};

// Sources:
//
// As heat transfer from radiator involves several calculations, the types just define the
// total surface area of the radiator (including fins) and the vertical plate height.
// Areas are in m^2, vertical plate heights are in m
Calc.constants.radiator_types = {
    modern_double:      { area: 4.4, height: 0.3 },
    modern_single:      { area: 2.2, height: 0.3 },
    single_unfinned:    { area: 0.5, height: 0.3 }
};

