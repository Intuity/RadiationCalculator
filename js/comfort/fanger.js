var Comfort = Comfort || {};

// Thermal comfort calculations utilsing P. Fanger's work on the subject,
// see the references below for explanations of the various formulas/terms:
// 1) http://ceae.colorado.edu/~brandem/aren3050/docs/ThermalComfort.pdf (Imperial)
// 2) http://sustainabilityworkshop.autodesk.com/buildings/human-thermal-comfort (Metric)

Comfort.Fanger = {};

// Returns an estimate of the saturation water vapor pressure
// at a particular temperature (in °C) in kPa. This implements
// the Antoine equation (https://en.wikipedia.org/wiki/Antoine_equation)
Comfort.Fanger.saturation_vapor_pressure = function(temp_in_c) {
    var log_p = (8.07131 - 1730.63 / (233.426 + temp_in_c));
    var p_mmHg = Math.pow(10, log_p); // in mmHg
    var p_kPa = p_mmHg * (101.325 / 760);
    return p_kPa;
};

// Returns the actual water vapor pressure from the relative
// humidity measurement (in %) at a particular temperature
// (in °C) in kPa.
Comfort.Fanger.actual_vapor_pressure = function(rel_humd, temp_in_c) {
    var sat_p = Comfort.Fanger.saturation_vapor_pressure(temp_in_c);
    var act_p = (rel_humd / 100.0) * sat_p;
    return act_p;
};

// Returns the absolute humidity from relative humidity (in %) &
// the temperature (in °C) in kg/m^3. Implements algorithm
// from http://planetcalc.com/2167/. For an alternative algorithm
// see: https://carnotcycle.wordpress.com/2012/08/04/
//      how-to-convert-relative-humidity-to-absolute-humidity/
Comfort.Fanger.absolute_humidity = function(rel_humd, temp_in_c) {
    var act_vp = (Comfort.Fanger.actual_vapor_pressure(rel_humd, temp_in_c) * 1000.0); // in Pa
    var gas_const_H2O = 461.5; // J/kg K
    var abs_humd = act_vp / (gas_const_H2O * (temp_in_c + 273.15)); // in kg/m^3
    return abs_humd; // Return in kg/m^3 (Si)
};

// Calculate the vapor pressure & absolute humidity values for each
// set of relative humidity & temperature values.
Comfort.Fanger.calculate_humidity_stats = function() {
    Comfort.results.vapor_pressure = [];
    Comfort.results.absolute_humidity = [];
    for(var i = 0; i < Comfort.raw_data.temperature_series.length; i++) {
        var temp = Comfort.raw_data.temperature_series[i];
        var humd = Comfort.raw_data.humidity_series[i];
        if(temp == null || humd == null) {
            Comfort.results.vapor_pressure.push(null);
            Comfort.results.absolute_humidity.push(null);
            continue;
        } else {
            Comfort.results.vapor_pressure.push(Comfort.Fanger.actual_vapor_pressure(humd, temp));
            Comfort.results.absolute_humidity.push(Comfort.Fanger.absolute_humidity(humd, temp));
        }
    }
};

// Calculate a single point PMV value using various environental & personal parameters
// Environment properties:  partial vapor pressure (p_a, kPa), air temperature (t_a, °C), 
//                          radiant temperature (t_r, °C), air velocity (v, m/s)
// Personal factors:        clothing insulation (I_cl, clo), metabolic rate (M, W/m^2), 
//                          external work (W, W/m^2)
/*Comfort.calculate_point_pmv_ppd = function(
    p_a, t_a, t_r, v,   
    I_cl, M, W          
) {
    // Calculate the clothing factor & clothing thermal insulation 
    // from the clothing insulation parameter
    var f_cl = (I_cl < 0.5) ? (1.0 + 0.2*I_cl) : (1.05 + 0.1*I_cl);
    var R_cl = 0.155*I_cl;
    // Calculate the convective head transfer coefficient
    var h_c = 12.1*Math.sqrt(v);
    // Calculate the surface temperature of clothing
    var M_W = (M - W);
    var t_cl_inner = (M_W - 3.05*(5.73 - 0.007*M_W - p_a) - 0.42*(M_W - 58.15) - 0.0173*M*(5.87 - p_a) - 0.0014*M*(34 - t_a));
    var t_cl = (35.7 - 0.0275*M_W - R_cl * t_cl_inner);
    // Calculate the PMV in multiple stages
    var PMV_1 = (0.303*Math.exp(-0.036 * M) + 0.028);
    var PMV_2 = (M_W - 3.96*Math.pow(10,-8)*f_cl*(Math.pow(t_cl + 273.15, 4) - Math.pow(t_r + 273.15, 4)));
    var PMV_3 = (f_cl*h_c*(t_cl - t_a) + 3.05*(5.73 - 0.007*M_W - p_a) + 0.42*(M_W - 58.15));
    var PMV_4 = (0.0173*M*(5.87 - p_a) + 0.0014*M*(34 - t_a));
    var PMV = PMV_1*(PMV_2 - PMV_3 - PMV_4);
    // Calculate the PPD value from the PMV value
    var PPD = (100 - 95*Math.exp(-1*(0.3353*Math.pow(PMV, 4) + 0.2179*Math.pow(PMV, 2))));
    // Return results
    return {
        PPD:    PPD,
        PMV:    PMV
    };
};*/

// Algorithm from ISO 7730:2005E, can be seen at:
// https://moodle.metropolia.fi/pluginfile.php/217631/mod_resource/content/1/EVS_EN_ISO_7730%3B2006_en.pdf
Comfort.Fanger.iso7730_point_pmv_ppd = function(
    p_a, t_a, t_r, v_ar,   
    I_cl, M, W          
) {
    // Apply parameter limits
    if(M < 46) M = 46;      else if(M > 232) M = 232;
    if(I_cl < 0) I_cl = 0;  else if(I_cl > 2) I_cl = 2;
    if(t_a < 10) t_a = 10;  else if(t_a > 30) t_a = 30;
    if(t_r < 10) t_r = 10;  else if(t_r > 40) t_r = 40;
    if(v_ar < 0) v_ar = 0;  else if(v_ar > 1) v_ar = 1;
    if(p_a < 0) p_a = 0;    else if(p_a > 2.7) p_a = 2.7;
    // Convert the air vapor pressure to Pa from kPa
    p_a = (p_a * 1000.0);
    // Convert I_cl to Km^2/W from clo & calc. clothing surface area factor
    var I_cl_metric = I_cl * 0.155;
    var f_cl = (I_cl_metric < 0.078) ? (1.00 + 1.290*I_cl_metric) : (1.05 + 0.645*I_cl_metric);
    // Calculate convective heative transfer coefficient & clothing surface temperature
    // - Initial guess using: http://sustainabilityworkshop.autodesk.com/buildings/human-thermal-comfort
    var t_cl_inner = ((M-W) - 3.05*(5.73 - 0.007*(M-W) - (p_a / 1e3)) - 0.42*((M-W) - 58.15) - 0.0173*M*(5.87 - (p_a / 1e3)) - 0.0014*M*(34 - t_a));
    var t_cl = (35.7 - 0.0275*(M-W) - I_cl_metric * t_cl_inner);
    var t_cl_0 = t_cl;
    var h_c = 0;
    var f_1 = 12.1 * Math.sqrt(v_ar);
    var values = [];
    for(var i = 0; i < 1000; i++) { // 10 iterations
        var f_2 = 2.38 * Math.pow(Math.abs(t_cl - t_a), 0.25);
        h_c = (f_2 > f_1) ? f_2 : f_1;
        var t_cl_calc = 35.7 - 0.028*(M-W) - I_cl_metric*(3.96e-8*f_cl*(Math.pow(t_cl+273,4) - Math.pow(t_r + 273, 4)) + f_cl*h_c*(t_cl - t_a));
        // To stop t_cl calc from shooting off to infinity, we average with the original guess
        // the previous iteration and the most recent calculation - together this gives a stable
        // result.
        var new_t_cl = (t_cl_calc + t_cl + t_cl_0) / 3.0;
        if(Math.abs(new_t_cl - t_cl) < 0.1) {
            t_cl = new_t_cl;
            break;
        }
        t_cl = new_t_cl;
        values.push(t_cl);
    }
    // Update h_c one last time to the determined t_cl
    var f_1 = 12.1 * Math.sqrt(v_ar);
    var f_2 = 2.38 * Math.pow(Math.abs(t_cl - t_a), 0.25);
    h_c = (f_2 > f_1) ? f_2 : f_1;
    // Now calculate PMV in stages
    var PMV_ln_1 = 0.303*Math.exp(-0.036*M) + 0.028;
    var PMV_ln_2 = (M-W) - 3.05e-3*(5733 - 6.99*(M-W) - p_a) - 0.42*((M-W) - 58.15);
    var PMV_ln_3 = -1.7e-5*M*(5867 - p_a) - 0.0014*M*(34 - t_a);
    var PMV_ln_4 = -3.96e-8*f_cl*(Math.pow(t_cl + 273, 4) - Math.pow(t_r + 273, 4)) - f_cl*h_c*(t_cl - t_a);
    var PMV = PMV_ln_1 * (PMV_ln_2 + PMV_ln_3 + PMV_ln_4);
    //  Calculate the PPD value from PMV
    var PPD = (100 - 95*Math.exp(-0.03353*Math.pow(PMV, 4) - 0.2179*Math.pow(PMV, 2)));
    // Return the result
    return {
        PPD:    PPD,
        PMV:    PMV
    };
};

// Calculation of PMV & PPD as per the example code given in ASHRAE Code 55
// CLO - Clothing insulation factor in clo
// MET - Metabolic rate of individual in met
// WME - External work rate (usually 0) in met
// TA - Air temperature in °C
// TR - Mean radiant temperature in °C
// VEL - Relative air velocity in m/s
// RH - Relative humidity of air in %
Comfort.Fanger.ashrae_55_point_pmv_ppd = function(CLO, MET, WME, TA, TR, VEL, RH) {
    // Calculate partial water vapor pressure from relative humidity
    var FNPS = function(T) { return Math.exp(16.6536 - 4030.184/(TA+235)); };
    var PA = RH * 10 * FNPS(TA);
    // Convert clothing insulation factor to SI (m^2K/W);
    var ICL = 0.155 * CLO;
    // Convert metabolic rate & external work rate to (W/m^2)
    var M = MET * 58.15;
    var W = WME * 58.15;
    // Work out internal heat production from body
    var MW = M - W;
    // Calculate the clothing area factor
    var FCL = (ICL < 0.078) ? (1 + 1.29 * ICL) : (1.05 + 0.645 * ICL);
    // Calculate the heat transfer coefficient by forced convection
    var HCF = 12.1 * Math.sqrt(VEL);
    // Calculate absolute air & mean radiant temperature
    var TAA = TA + 273;
    var TRA = TR + 273;
    // Calculate surface temperature of clothing by iteration
    var TCLA = TAA + (35.5 - TA) / (3.5 * (6.45 * ICL + 0.1)); // First guess
    var P1 = ICL * FCL;
    var P2 = P1 * 3.96;
    var P3 = P1 * 100;
    var P4 = P1 * TAA;
    var P5 = 308.7 - 0.028 * MW + P2 * Math.pow((TRA / 100), 4);
    var XN = TCLA / 100.0;
    var XF = XN;
    var EPS = 0.00015; // Stop criterian
    for(var N = 0; N < 150; N++) {
        XF = (XF + XN) / 2.0;
        // Heat transfer coefficient by natural convection
        var HCN = 2.38 * Math.pow(Math.abs(100 * XF - TAA), 0.25);
        var HC = (HCF > HCN) ? HCF : HCN;
        XN = (P5 + P4*HC - P2*Math.pow(XF, 4)) / (100 + P3*HC);
        if(Math.abs(XN - XF) <= EPS) break;
    }
    // Calculate surface temperature of clothing
    var TCL = 100*XN - 273;
    // Heat loss components
    var HL1 = 3.05 * 0.001 * (5733 - 6.99*MW - PA); // Heat loss diff through skin
    var HL2 = (MW > 58.15) ? (0.42 * (MW - 58.15)) : 0; // Heat loss by sweating (comfort)
    var HL3 = 1.7 * 0.00001 * M * (5867 - PA); // Latent respiration heat loss
    var HL4 = 0.0014 * M * (34 - TA); // Dry respiration heat loss
    var HL5 = 3.96 * FCL * (Math.pow(XN, 4) - Math.pow((TRA/100), 4)); // Heat loss by radiation
    var HL6 = FCL * HC * (TCL - TA);
    // Calculate PMV & PPD
    var TS = 0.303 * Math.exp(-0.036 * M) + 0.028; // Thermal sensation transfer coefficient
    var PMV = TS * (MW - HL1 - HL2 - HL3 - HL4 - HL5 - HL6); // Predicted mean vote
    var PPD = 100 - 95*Math.exp(-0.03353*Math.pow(PMV,4) - 0.2179*Math.pow(PMV, 2)); // Predicted percentage dissatisfaction
    return {
        PMV:    PMV,
        PPD:    PPD
    };
};

// Calculate the PMV (Predicted Mean Vote) & PPD values using the 
// temperature, humidity and pressure at each point in time. The 
// calculation also uses a number of environmental & personal 
// factors which can either be provided as fixed values or as a 
// series with equal length to temp & humd series.
Comfort.Fanger.calculate_pmv_ppd_series = function(temp_series, humd_series, air_vel, ins_cloth, met_rate, ext_work, push_results) {
    // Iterate through the provided series to calculate PMV & PPD
    // at each point in time
    var result = [];
    for(var i = 0; i < temp_series.length; i++) {
        var temp = temp_series[i];
        var humd = humd_series[i];
        var v_air = (typeof air_vel == 'number') ? air_vel : air_vel[i];
        var I_cl = (typeof ins_cloth == 'number') ? ins_cloth : ins_cloth[i];
        var M = (typeof met_rate == 'number') ? met_rate : met_rate[i];
        var W = (typeof ext_work == 'number') ? ext_work : ext_work[i];
        if(temp == null || humd == null || v_air == null || I_cl == null || M == null || W == null) {
            result.push(null);
            if(push_results) {
                Comfort.results.pmv_values.push(null);
                Comfort.results.ppd_values.push(null);
            }
            continue;
        } else {
            // Establish vapor pressure, air temp & mean radiant temp
            var p_a = Comfort.Fanger.actual_vapor_pressure(humd, temp);
            var t_a = temp;
            var t_r = temp; // Assume radiant = air temp
            // Calculate PMV + PPD
            /*var pmv_ppd = Comfort.Fanger.calculate_point_pmv_ppd(
                p_a, t_a, t_r, v_air, I_cl, M, W
            );*/
            var pmv_ppd = Comfort.Fanger.ashrae_55_point_pmv_ppd(
                I_cl, (M / 58), (W / 58), t_a, t_r, v_air, humd
            );
            result.push(pmv_ppd);
            // If requested, push into the global results store
            if(push_results) {
                Comfort.results.pmv_values.push(pmv_ppd.PMV);
                Comfort.results.ppd_values.push(pmv_ppd.PPD);
            }
        }
    }
    return result;
};