var Calc = Calc || {};

// Get a specific property of dry air interpolated at a given temperature
// Arguments:
// prop - String, the key of the property:
//  • c_p : Specific heat at constant pressure (kJ/kgK)
//  • c_v : Specific heat at constant volume (kJ/kgK)
//  • cp_cv : Ratio of c_p / c_v
//  • mu : Dynamic viscosity (kg/ms)
//  • k : Thermal conductivity (kW/mK)
//  • pr : The Prandtl number
//  • v : Kinematic viscosity (m^2/s)
//  • rho : Density (kg/m^3)
Calc.air_prop_at_temp = function(prop, temp) {
    var prop_keys = ['c_p','c_v','cp_cv','mu','k','pr','v','rho'];
    if(prop_keys.indexOf(prop) < 0) return undefined;
    else if(temp < 175 || temp > 1900) return undefined;
    // Get the lower and upper bounding value sets
    var lower = null;
    var upper = null;
    for(var i = 0; i < Calc.constants.air_properties.length; i++) {
        var prop_set = Calc.constants.air_properties[i];
        if(prop_set.temperature <= temp) {
            lower = prop_set;
            if(i < Calc.constants.air_properties.length) {
                upper = Calc.constants.air_properties[i+1];
            }
        }
    }
    // First check if we have values
    if(lower == null) return;
    else if(upper == null) return lower[prop];
    // Else interpolate
    var lower_val = lower[prop];
    var lower_temp = lower.temperature;
    var upper_val = upper[prop];
    var upper_temp = upper.temperature;
    return (lower_val + (upper_val - lower_val) * ((temp - lower_temp) / (upper_temp - lower_temp)));
};

// Get the saturation vapor pressure for a specific temperature in kPa
Calc.vapor_saturation_pressure_at_temp = function(temp) {
    if(temp < 258.15 || temp > 325.15) return undefined;
    // Get the lower and upper bounding value sets
    var lower = null;
    var upper = null;
    for(var i = 0; i < Calc.constants.vapor_saturation_pressures.length; i++) {
        var prop_set = Calc.constants.vapor_saturation_pressures[i];
        if(prop_set.temperature <= temp) {
            lower = prop_set;
            if(i < Calc.constants.vapor_saturation_pressures.length) {
                upper = Calc.constants.vapor_saturation_pressures[i+1];
            }
        }
    }
    // First check if we have values
    if(lower == null) return;
    else if(upper == null) return lower.p_sat_kpa;
    // Else interpolate
    var lower_val = lower.p_sat_kpa;
    var lower_temp = lower.temperature;
    var upper_val = upper.p_sat_kpa;
    var upper_temp = upper.temperature;
    return (lower_val + (upper_val - lower_val) * ((temp - lower_temp) / (upper_temp - lower_temp)));
};

// Calculate partial vapor pressure from relative humidity at a specific temperature in kPa
Calc.partial_vapor_pressure = function(rel_humd, temp) {
    var sat_pressure = Calc.vapor_saturation_pressure_at_temp(temp);
    var vapor_pressure = (rel_humd / 100.0) * sat_pressure;
    return vapor_pressure;
};

// Calculate the humidity ratio from air pressure, relative humidity & temperature (unitless)
Calc.humidity_ratio = function(air_pressure, rel_humd, temp) {
    var partial_pressure = Calc.partial_vapor_pressure(rel_humd, temp);
    var x = 0.62198*(partial_pressure / (air_pressure - partial_pressure));
    return x;
};

// Calculate the specific enthalpy of the humid air in kJ/kg
Calc.specific_enthalpy = function(air_pressure, rel_humd, temp) {
    var x = Calc.humidity_ratio(air_pressure, rel_humd, temp);
    var h_dry_air = Calc.air_prop_at_temp('c_p', temp) * temp;
    var h_water_vapor = 2539.9; // at 21°C, in kJ/kg
    var h = h_dry_air + x * h_water_vapor;
    return h;
};

// Calculate the convective heat transfer from radiator into air in W
Calc.radiator_heat_transfer = function(rad_type, t_rad, t_room) {
    var rad_props = Calc.constants.radiator_types[rad_type];
    var area = rad_props.area;
    var height = rad_props.height;
    var t_film = (t_room + t_rad) / 2.0;
    // Calculate the Grashof number
    var kin_visc = Calc.air_prop_at_temp('v', t_film);
    var Gr_numerator = (9.81 * Math.pow(height, 3) * (t_rad - t_room));
    var Gr_denominator = (Math.pow(kin_visc, 2) * t_film);
    var Gr = (Gr_numerator / Gr_denominator);
    // Calculate the Raleigh number
    var Pr = Calc.air_prop_at_temp('pr', t_film);
    var Ra = (Gr * Pr);
    // Calculate the Nusselt number
    var Nu = (Ra < 1E9) ? (0.59 * Math.pow(Ra, 0.25)) : (0.1 * Math.pow(Ra, (1/3)));
    // Use formula Nu = hL/k to get h = Nu*k/L (convective heat transfer coeff.)
    var k = Calc.air_prop_at_temp('k', t_film);
    var h = ((Nu * k) / height) * 1000.0; // conv. heat. transfer coeff. in W/m^2K
    // Calculate the heat flux using h
    var Q = (h * area * (t_rad - t_room));
    // Return the heat flux in W
    return Q;
};

// Calculate the heat loss through the walls in the room
Calc.wall_heat_transfers = function(width, height, depth, walls, wall_type, window_area, window_type, t_room, t_ext) {
    // Work out the total wall transfer rate
    var wall_area = (-1*window_area);
    if(walls.north == true)  wall_area += (width*height);
    if(walls.east == true)   wall_area += (depth*height);
    if(walls.south == true)  wall_area += (width*height);
    if(walls.west == true)   wall_area += (depth*height);
    var wall_u = Calc.constants.wall_types[wall_type]; // in W/m^2K
    var wall_flux = (wall_u * wall_area); // in W/K
    // Work out the total window transfer rate
    var window_u = Calc.constants.window_types[window_type];
    var window_flux = (window_u * window_area);
    // Work out the heat flux to the outside world
    var Q = (wall_flux + window_flux) * (t_room - t_ext);
    return {
        wall:   wall_flux * (t_room - t_ext),
        window: window_flux * (t_room - t_ext),
        total:  Q
    };
};

// Calculate the rate of heat loss due to air changes per hour between the room and the environment (in W)
Calc.air_changes_per_hour_transfer = function(width, height, depth, num_ach, t_room, t_ext, pressure, humidity) {
    // Work out the total air exchanged between inside and environment per hour
    var exchanged_air_volume = (width * height * depth) * num_ach;
    // Work out the total enthalpy of the air exiting the room over the course of the hour
    var air_mass_internal = exchanged_air_volume * Calc.air_prop_at_temp('rho', t_room);
    var enthalpy_internal = Calc.specific_enthalpy(pressure, humidity, t_room) * air_mass_internal;
    // Work out the total enthalpy of the air entering the room over the course of the hour
    var air_mass_external = exchanged_air_volume * Calc.air_prop_at_temp('rho', t_ext);
    var enthalpy_external = Calc.specific_enthalpy(pressure, humidity, t_ext) * air_mass_external;
    // Work out the net change in enthalpy of air within the room
    var enthalpy_delta = (enthalpy_internal - enthalpy_external);
    // Convert kJ per hour to W
    return (enthalpy_delta / 3.6); // Convert kJ per hour to W
};

Calc.find_equilibrium_t_rad = function(
    width, height, depth, walls, wall_type, window_area, window_type, rad_type, t_room, t_ext, num_ach, pressure, humidity
) {
    // Radiator temperature sweep range (to find equilibrium)
    var t_rad_min  = (273.15 + 0);
    var t_rad_max  = (273.15 + 100);
    var t_rad_step = 0.1;
    
    // Sweep to find x-axis intersection
    var prev_flux = null;
    var t_equilibrium = undefined;
    
    for(var t_rad = t_rad_min; t_rad <= t_rad_max; t_rad += t_rad_step) {
        var test_flux_in  = Calc.radiator_heat_transfer(rad_type, t_rad, t_room);
        var wall_window_out = Calc.wall_heat_transfers(width, height, depth, walls, wall_type, window_area, window_type, t_room, t_ext);
        var test_flux_out = wall_window_out.total;
        test_flux_out += Calc.air_changes_per_hour_transfer(width, height, depth, num_ach, t_room, t_ext, pressure, humidity);
        var test_flux_net = (test_flux_in - test_flux_out);
        if(prev_flux != null) {
            if(prev_flux <= 0 && test_flux_net >= 0) {
                // Found the equilibrium point - interpolate out the temperature
                var prev_t_rad = (t_rad - t_rad_step);
                var int_temp = (prev_t_rad + (t_rad - prev_t_rad)*((0 - prev_flux)/(test_flux_net - prev_flux)));
                t_equilibrium = int_temp; // in °C
                break;
            }
        }
        prev_flux = test_flux_net;
    }
    
    return t_equilibrium;
};

Calc.find_equilibrium_t_room = function(
    width, height, depth, walls, wall_type, window_area, window_type, rad_type, t_rad, t_ext, num_ach, pressure, humidity
) {
    // Room temperature sweep range (to find equilibrium)
    var t_room_min  = t_ext;
    var t_room_max  = (273.15 + 100);
    var t_room_step = 0.5;
    
    // Sweep to find x-axis intersection
    var prev_flux = null;
    var t_equilibrium = undefined;
    
    for(var t_room = t_room_min; t_room <= t_room_max; t_room += t_room_step) {
        var test_flux_in = Calc.radiator_heat_transfer(rad_type, t_rad, t_room);
        var wall_window_out = Calc.wall_heat_transfers(width, height, depth, walls, wall_type, window_area, window_type, t_room, t_ext);
        var air_out = Calc.air_changes_per_hour_transfer(width, height, depth, num_ach, t_room, t_ext, pressure, humidity);
        var test_flux_out = wall_window_out.total + air_out;
        var test_flux_net = (test_flux_in - test_flux_out);
        if(prev_flux != null) {
            if((prev_flux <= 0 && test_flux_net >= 0) || (prev_flux >= 0 && test_flux_net <= 0)) {
                // Found the equilibrium point - interpolate out the temperature
                var prev_t_room = (t_room - t_room_step);
                var int_temp = (prev_t_room + (t_room - prev_t_room)*((0 - prev_flux)/(test_flux_net - prev_flux)));
                t_equilibrium = int_temp; // in °C
                break;
            }
        }
        prev_flux = test_flux_net;
    }

    return t_equilibrium;
};

// Return the time to increase the room temperature from one temperature to another in seconds
Calc.time_to_heat = function(
    width, height, depth, walls, wall_type, window_area, window_type, rad_type, t_rad, t_room_start, 
    t_room_end, t_ext, num_ach, pressure, humidity
) {
    // Get the room's volume
    var volume = (width * height * depth);
    
    // Some control parameters
    var t_step = 0.1;
    
    // Results
    var total_time = 0;
    var total_energy_gain = 0;
    
    for(var t_room = t_room_start; t_room < t_room_end; t_room += t_step) {
        // First work out total humid air mass at this temperature
        var dry_air_density = Calc.air_prop_at_temp('rho', t_room);
        var dry_air_mass = (dry_air_density * volume);
        var humidity_ratio = Calc.humidity_ratio(pressure, humidity, t_room);
        var vapor_mass = (dry_air_mass * humidity_ratio);
        var air_mass = (dry_air_mass + vapor_mass);
        
        // Now work out the enthalpy change between current temperature & one step higher
        var spec_enthalpy_current = Calc.specific_enthalpy(pressure, humidity, t_room);
        var spec_enthalpy_next = Calc.specific_enthalpy(pressure, humidity, (t_room + t_step));
        var enthalpy_delta = air_mass * (spec_enthalpy_next - spec_enthalpy_current); // in kJ
        
        // Work out the heat input to the room at this temperature
        var heat_in = Calc.radiator_heat_transfer(rad_type, t_rad, t_room);
        var wall_window_out = Calc.wall_heat_transfers(width, height, depth, walls, wall_type, window_area, window_type, t_room, t_ext);
        var heat_out = wall_window_out.total;
        heat_out += Calc.air_changes_per_hour_transfer(width, height, depth, num_ach, t_room, t_ext, pressure, humidity);
        var net_heat_in = heat_in - heat_out; // in Watts
        
        if(net_heat_in <= 0) {
            console.error('Heat flux into room negative - will never heat up! ');
            return undefined;
        }
        
        // Work out the time to increase by the enthalpy delta
        var delta_time = (enthalpy_delta * 1000.0) / net_heat_in;
        
        // Add to results
        total_time += delta_time;
        total_energy_gain += enthalpy_delta;
    }
    return total_time;
};

// Return the temperatures achieved over time when heating the room from an initial temperature, 2D return!
Calc.temperatures_over_time = function(
    width, height, depth, walls, wall_type, window_area, window_type, rad_type, t_rad, t_room_start, t_ext, num_ach, pressure, humidity
) {
    // Get the room's volume
    var volume = (width * height * depth);
    
    // Some control parameters
    var time_length = 21600; // 6 Hours in seconds
    var time_step = 30;
    var temp_step_size = 0.01;
    
    // Results
    var times = [];
    var temperatures = [];
    var current_temperature = t_room_start;
    
    for(var time = 0; time <= time_length; time += time_step) {
        times.push((time / 60.0));
        
        // First work out total humid air mass at this temperature
        var dry_air_density = Calc.air_prop_at_temp('rho', current_temperature);
        var dry_air_mass = (dry_air_density * volume);
        var humidity_ratio = Calc.humidity_ratio(pressure, humidity, current_temperature);
        var vapor_mass = (dry_air_mass * humidity_ratio);
        var air_mass = (dry_air_mass + vapor_mass);
        
        // Work out the heat input to the room at this temperature
        var heat_in = Calc.radiator_heat_transfer(rad_type, t_rad, current_temperature);
        var wall_window_out = Calc.wall_heat_transfers(width, height, depth, walls, wall_type, window_area, window_type, current_temperature, t_ext);
        var heat_out = wall_window_out.total;
        heat_out += Calc.air_changes_per_hour_transfer(width, height, depth, num_ach, current_temperature, t_ext, pressure, humidity);
        var net_heat_in = heat_in - heat_out; // in Watts
        var net_energy_in = net_heat_in * time_step; // in joules
        
        if(net_energy_in == 0) {
            temperatures.push(current_temperature);
            continue;
        }
        
        // Else solution has to be by iteration
        var spec_enthalpy_current = Calc.specific_enthalpy(pressure, humidity, current_temperature);
        var temp_step = ((net_heat_in > 0) ? +1 : -1) * temp_step_size; // Move in the correct direction for energy flux
        var test_temperature = current_temperature;
        var enthalpy_delta = 0;
        do {
            test_temperature += temp_step;
            var spec_enthalpy_test = Calc.specific_enthalpy(pressure, humidity, test_temperature);
            var spec_enthalpy_delta = (spec_enthalpy_test - spec_enthalpy_current) * 1000.0; // in Joules
            enthalpy_delta = spec_enthalpy_delta * air_mass;
        } while(Math.abs(enthalpy_delta) < Math.abs(net_energy_in));
        
        // Store and prepare for the next step
        temperatures.push(test_temperature - 273.15);
        current_temperature = test_temperature;
        
    }
    
    return {
        times:          times,
        temperatures:   temperatures
    };
};

Calc.calculate_comfort_levels = function(
    temperature, humidity, velocity
) {
    var models = ['naked','sleeping','office','office_jumper','coat','running'];
    for(var i = 0; i < models.length; i++) {
        // Calculate the PMV/PPD
        var pmv_ppd = Comfort.Subjects.calculate_point_comfort_level(
            models[i], (temperature - 273.15), humidity, velocity
        );
        var pmv = pmv_ppd.PMV;

        // Fill in the icons and colours as required
        var colour = '#0F0';
        var icon = 'fa fa-check-circle-o';
        var text = 'Neutral';
        
        if(pmv >= 0.8 && pmv < 1.8) {
            colour = '#CCFF33';
            icon = 'fa fa-asterisk';
            text = 'Warm';
        } else if(pmv >= 1.8 && pmv < 2.8) {
            colour = '#FF9900';
            icon = 'fa fa-exclamation';
            text = 'Hot';
        } else if(pmv >= 2.8) {
            colour = '#FF0000';
            icon = 'fa fa-exclamation-triangle';
            text = 'Very Hot';
        } else if(pmv <= -0.8 && pmv > -1.8) {
            colour = '#00FF99';
            icon = 'fa fa-asterisk';
            text = 'Cool';
        } else if(pmv <= -1.8 && pmv > -2.8) {
            colour = '#33CCCC';
            icon = 'fa fa-exclamation';
            text = 'Cold';
        } else if(pmv <= -2.8) {
            colour = '#00CCFF';
            icon = 'fa fa-exclamation-triangle';
            text = 'Very Cold';
        }
        
        // Find and fill the right DOM elements
        var i_el = document.getElementById('comfort_' + models[i] + '_result_icon');
        var t_el = document.getElementById('comfort_' + models[i] + '_result_text');
        
        i_el.style.color = colour;
        i_el.setAttribute('class', icon);
        t_el.innerHTML = text;
    }
};

Calc.results = {
    considered_t_ext:   [],
    considered_t_rad:   [],
    heat_fluxes:        [],
    t_rad_equilibrium:  [],
    t_room_equilibrium: [],
    times_to_heat:      []
};

Calc.run = function() {
    // First read in all of the parameters
	var mode = document.getElementById('calc_type').options[document.getElementById('calc_type').selectedIndex].value;
    var t_room = parseFloat(document.getElementById('t_room').value) + 273.15;
    var t_room_initial = parseFloat(document.getElementById('t_room_initial').value) + 273.15;
    var t_room_target  = parseFloat(document.getElementById('t_room_target').value) + 273.15;
    var t_environment  = parseFloat(document.getElementById('t_environment').value) + 273.15;
    var width = parseFloat(document.getElementById('width').value);
    var height = parseFloat(document.getElementById('height').value);
    var depth = parseFloat(document.getElementById('depth').value);
    var walls = {
        north:  document.getElementById('wall_north').checked,
        east:   document.getElementById('wall_east').checked,
        south:  document.getElementById('wall_south').checked,
        west:   document.getElementById('wall_west').checked
    };
    var wall_type = document.getElementById('wall_type').options[document.getElementById('wall_type').selectedIndex].value;
    var window_area = parseFloat(document.getElementById('window_area').value);
    var window_type = document.getElementById('window_type').options[document.getElementById('window_type').selectedIndex].value;
    var radiator_temperature = parseFloat(document.getElementById('t_rad').value) + 273.15;
    var radiator_type = document.getElementById('radiator_type').options[document.getElementById('radiator_type').selectedIndex].value;
    var gas_price = parseFloat(document.getElementById('gas_price').value);
    var air_humidity = parseFloat(document.getElementById('air_humidity').value); // in % RH
    var air_velocity = parseFloat(document.getElementById('air_velocity').value); // in m/s
    var air_pressure = parseFloat(document.getElementById('air_pressure').value); // in kPa
    var num_ach = parseFloat(document.getElementById('number_ach').value); // Air Changes per Hour (ACH)
    var rad_panel_width = parseFloat(document.getElementById('panel_width').value); // in m
    var rad_panel_height = parseFloat(document.getElementById('panel_height').value); // in m
    var rad_num_panels = parseFloat(document.getElementById('panel_count').value);
    var rad_num_fin_layers = parseFloat(document.getElementById('fin_layer_count').value);
    var co2_per_kwh = 0.185; // kg/kWh - http://www.carbonindependent.org/sources_home_energy.html
    
    // External temperature sweep range
    var t_ext_min = (273.15 - 12);
    var t_ext_max = (273.15 + 18);
    var t_ext_step = 0.5;
    
    // Radiator temperature sweep range
    var t_rad_min = (273.15 + 25);
    var t_rad_max = (273.15 + 80);
    var t_rad_step = 0.5;
    
    // Results
    Calc.results.considered_t_ext = [];
    Calc.results.considered_t_rad = [];
    Calc.results.heat_fluxes = [];
    Calc.results.t_rad_equilibrium = [];
    Calc.results.t_room_equilibrium = [];
    Calc.results.times_to_heat = [];
    
    // Sweep across the external temperature range
    var heat_in = Calc.radiator_heat_transfer(radiator_type, radiator_temperature, t_room);
    for(var t_ext = t_ext_min; t_ext <= t_ext_max; t_ext += t_ext_step) {
        Calc.results.considered_t_ext.push(t_ext - 273.15); // in °C
        
        if(mode == 'equilibrium_temps') {
            // Find the radiator temperature to establish equilibrium
            var t_rad_equilibrium = Calc.find_equilibrium_t_rad(
                width, height, depth, walls, wall_type, window_area, window_type, radiator_type, t_room, t_ext, 
                num_ach, air_pressure, air_humidity
            );
            Calc.results.t_rad_equilibrium.push(t_rad_equilibrium - 273.15); // in °C
        
            // Find the equilibrium room temperature between radiator temperature & external temperature
            var t_room_equilibrium = Calc.find_equilibrium_t_room(
                width, height, depth, walls, wall_type, window_area, window_type, radiator_type, radiator_temperature, t_ext,
                num_ach, air_pressure, air_humidity
            );
            if(t_room_equilibrium != undefined) Calc.results.t_room_equilibrium.push(t_room_equilibrium - 273.15);
            else Calc.results.t_room_equilibrium.push(undefined);
        }
        
        // Calculate time to increase room temperature from 15°C to t_room, provided t_room is not < 21°C
        if(mode == 'time_to_heat') {
            if(t_room > 288.15) {
                var heat_time = Calc.time_to_heat(
                    width, height, depth, walls, wall_type, window_area, window_type, radiator_type, 
                    radiator_temperature, t_room_initial, t_room_target, t_ext, num_ach, air_pressure, air_humidity
                );
                Calc.results.times_to_heat.push(heat_time / 60.0); // In minutes
            }
        }
    }
    
    // Sweep across the radiator temperature range
    var wall_window_out = Calc.wall_heat_transfers(width, height, depth, walls, wall_type, window_area, window_type, t_room, t_environment);
    var heat_out = wall_window_out.total;
    heat_out += Calc.air_changes_per_hour_transfer(width, height, depth, num_ach, t_room, t_environment, air_pressure, air_humidity);
    for(var t_rad = t_rad_min; t_rad <= t_rad_max; t_rad += t_rad_step) {
        Calc.results.considered_t_rad.push(t_rad - 273.15); // in °C
        var heat_in  = Calc.radiator_heat_transfer(radiator_type, t_rad, t_room_target);
        // Calculate the heat flux
        if(mode == 'consumption_month') {
            var net_flux = (heat_in - heat_out);
            Calc.results.heat_fluxes.push(net_flux);
        }
    }
    
    // Run the temperatures over time calculation
    if(mode == 'time_to_heat') {
        var time_result = Calc.temperatures_over_time(
            width, height, depth, walls, wall_type, window_area, window_type, radiator_type, radiator_temperature,
            t_room_initial, t_environment, num_ach, air_pressure, air_humidity
        );
    }
    
    // Run radiator output calculations
    if(mode == 'radiator_output') {
        // Get the parameters
        var t_film = (radiator_temperature + t_room) / 2.0;
        var Gr = Calc.Radiator.calculate_grashof(rad_panel_height, radiator_temperature, t_room);
        var Pr = Calc.Radiator.lookup_prandtl(t_film);
        var Ra = (Gr * Pr);
        var Nu = Calc.Radiator.calculate_nusselt(rad_panel_height, radiator_temperature, t_room);
        document.getElementById('radiator_film_temperature').innerHTML = (t_film - 273.15).toFixed(1);
        document.getElementById('radiator_grashof').innerHTML = (Gr / 1E6).toFixed(1);
        document.getElementById('radiator_prandtl').innerHTML = Pr.toFixed(3);
        document.getElementById('radiator_raleigh').innerHTML = (Ra / 1E6).toFixed(1);
        document.getElementById('radiator_nusselt').innerHTML = Nu.toFixed(1);
        // Run heat transfer calculation
        var heat_results = Calc.Radiator.calculate_heat_output(
            rad_panel_width, rad_panel_height, rad_num_panels, rad_num_fin_layers, radiator_temperature, t_room
        );
        document.getElementById('radiator_panel_area').innerHTML = heat_results.panel_area.toFixed(1);
        document.getElementById('radiator_fin_area').innerHTML = heat_results.fin_area.toFixed(1);
        document.getElementById('radiator_total_area').innerHTML = heat_results.area.toFixed(1);
        document.getElementById('radiator_convective_coeff').innerHTML = (heat_results.convect_coeff * 1E3).toFixed(1);
        document.getElementById('radiator_conv_output_per_deg').innerHTML = heat_results.conv_heat_per_deg.toFixed(1);
        document.getElementById('radiator_conv_output').innerHTML = heat_results.conv_heat_output.toFixed(1);
        var conv_perc = (100.0 * heat_results.conv_heat_output / heat_results.total_heat_output).toFixed(1);
        document.getElementById('radiator_conv_percentage').innerHTML = conv_perc + "%";
        document.getElementById('radiator_rdtd_output').innerHTML = heat_results.rdtd_heat_output.toFixed(1);
        var rdtd_perc = (100.0 * heat_results.rdtd_heat_output / heat_results.total_heat_output).toFixed(1);
        document.getElementById('radiator_rdtd_percentage').innerHTML = rdtd_perc + "%";
        document.getElementById('radiator_total_output').innerHTML = heat_results.total_heat_output.toFixed(1);
    }

    // Setup colour palette for plotting
    var palette = new Rickshaw.Color.Palette();
    
    // Plot charts and populated data fields
    if(mode == 'consumption_month') {
        Calc.calculate_comfort_levels(t_room_target, air_humidity, air_velocity);
        
        // Work out the equilibrium radiator temperature
        var t_rad_equilibrium = Calc.find_equilibrium_t_rad(
            width, height, depth, walls, wall_type, window_area, window_type, radiator_type, t_room_target, 
            t_environment, num_ach, air_pressure, air_humidity
        );
        var equilibrium_heat_in = Calc.radiator_heat_transfer(radiator_type, t_rad_equilibrium, t_room_target);
        var wall_window_out = Calc.wall_heat_transfers(
            width, height, depth, walls, wall_type, window_area, window_type, t_room_target, t_environment
        );
        var air_out = Calc.air_changes_per_hour_transfer(
            width, height, depth, num_ach, t_room_target, t_environment, air_pressure, air_humidity
        );
        
        // Summary
        document.getElementById('required_rad_temp').innerHTML = (t_rad_equilibrium - 273.15).toFixed(1);
        document.getElementById('energy_input_day').innerHTML = ((equilibrium_heat_in * 24) / 1000.0).toFixed(1);
        document.getElementById('energy_input_month').innerHTML = ((equilibrium_heat_in * 24 * 30) / 1000.0).toFixed(1);
        document.getElementById('energy_cost_month').innerHTML = ((equilibrium_heat_in * 24 * 30 * gas_price) / 1000.0).toFixed(2);
        document.getElementById('co2_emit_month').innerHTML = ((equilibrium_heat_in * 24 * 30 * co2_per_kwh) / 1000.0).toFixed(1);
        
        // Plot net heat
        Calc.plot_scatter_graph('heat_flux_plot',       palette, Calc.results.considered_t_rad, Calc.results.heat_fluxes);
        
        // Breakdown
        document.getElementById('breakdown_heat_input').innerHTML = equilibrium_heat_in.toFixed(1);
        document.getElementById('breakdown_heat_walls').innerHTML = wall_window_out.wall.toFixed(1);
        document.getElementById('breakdown_heat_windows').innerHTML = wall_window_out.window.toFixed(1);
        document.getElementById('breakdown_heat_ach').innerHTML = air_out.toFixed(1);
        var total_out = (wall_window_out.total + air_out);
        document.getElementById('breakdown_percentage_walls').innerHTML = (100 * wall_window_out.wall / total_out).toFixed(1);
        document.getElementById('breakdown_percentage_windows').innerHTML = (100 * wall_window_out.window / total_out).toFixed(1);
        document.getElementById('breakdown_percentage_ach').innerHTML = (100 * air_out / total_out).toFixed(1);
    }
    
    if(mode == 'equilibrium_temps') {
        Calc.plot_scatter_graph('radiator_equil_plot', palette, Calc.results.considered_t_ext, Calc.results.t_rad_equilibrium);
        Calc.plot_scatter_graph('room_equil_plot', palette, Calc.results.considered_t_ext, Calc.results.t_room_equilibrium);
    }
    
    if(mode == 'time_to_heat') {
        Calc.plot_line_graph('heating_times_plot', palette, Calc.results.considered_t_ext, Calc.results.times_to_heat);
        var trend_series = [];
        for(var i = 0; i < time_result.temperatures.length; i++) {
            if((i % 5) == 0) trend_series.push(t_room_target - 273.15);
            else trend_series.push(undefined);
        }
        Calc.plot_line_graph('heating_temperature_times_plot', palette, time_result.times, time_result.temperatures, undefined, undefined, trend_series);
    }
};


Calc.plot_scatter_graph = function(id, palette, x_series, y_series, def_min, def_max) {
    // Get the important elements
    var holder = document.getElementById(id + '_holder');
    var plot = document.getElementById(id);
    var y_axis_el = document.getElementById(id + '_y_axis');
    var x_axis_el = document.getElementById(id + '_x_axis');
    // Clear any previous plot
    plot.innerHTML = y_axis_el.innerHTML = x_axis_el.innerHTML = '';
    // Prepare the data to plot
    var prep_data = [];
    var spacer_series = [];
    var min = null;
    var max = null;
    for(var i = 0; i < x_series.length; i++) {
        if(
            x_series[i] != undefined && !isNaN(x_series[i]) &&
            y_series[i] != undefined && !isNaN(y_series[i])
        ) {
            if(def_min == undefined && (min == undefined || y_series[i] < min)) min = y_series[i];
            if(def_max == undefined && (max == undefined || y_series[i] > max)) max = y_series[i];
            prep_data.push({
                x:  x_series[i],
                y:  y_series[i]
            });
        } else if(x_series[i] != undefined) {
            spacer_series.push({
                x:  x_series[i],
                y:  null
            });
        }
    }
    
    // Plot
    var graph = new Rickshaw.Graph({
        element:    plot,
        renderer:   'scatterplot',
        series:     [
            {
                name:   id,
                data:   prep_data,
                color:  palette.color()
            },
            {
                data:   spacer_series
            }
        ],
        width:      plot.offsetWidth,
        height:     plot.offsetHeight,
        min:        (def_min == undefined) ? (min - (max-min) * 0.2) : def_min,
        max:        (def_max == undefined) ? (max + (max-min) * 0.2) : def_max
    });
    
    var x_axis = new Rickshaw.Graph.Axis.X({ 
        graph:          graph,
        element:        x_axis_el,
        orientation:    'bottom',
        ticks:          20
    });
    var y_axis = new Rickshaw.Graph.Axis.Y({
        graph:          graph,
        orientation:    'left',
        //tickFormat:     Rickshaw.Fixtures.Number.formatKMBT,
        ticks:          10,
        element:        y_axis_el
    });
    var hoverDetail = new Rickshaw.Graph.HoverDetail({
    	graph:      graph,
        xFormatter: function(x) {
            return "T<sub>ext</sub> " + x.toFixed(1) + "&deg;C";
        },
        formatter:  function(series, x, y) {
            return ("Y: " + y.toFixed(1));
        }
    });
    
    graph.render();
};

Calc.plot_line_graph = function(id, palette, x_series, y_series, def_min, def_max, trend_series) {
    // Get the important elements
    var holder = document.getElementById(id + '_holder');
    var plot = document.getElementById(id);
    var y_axis_el = document.getElementById(id + '_y_axis');
    var x_axis_el = document.getElementById(id + '_x_axis');
    // Clear any previous plot
    plot.innerHTML = y_axis_el.innerHTML = x_axis_el.innerHTML = '';
    // Prepare the data to plot
    var prep_data = [];
    var prep_trend_data = [];
    var spacer_series = [];
    var min = null;
    var max = null;
    for(var i = 0; i < x_series.length; i++) {
        if(
            x_series[i] != undefined && !isNaN(x_series[i]) &&
            y_series[i] != undefined && !isNaN(y_series[i])
        ) {
            if(def_min == undefined && (min == undefined || y_series[i] < min)) min = y_series[i];
            if(def_max == undefined && (max == undefined || y_series[i] > max)) max = y_series[i];
            prep_data.push({
                x:  x_series[i],
                y:  y_series[i]
            });
            if(trend_series != undefined && i < trend_series.length) {
                prep_trend_data.push({
                    x: x_series[i],
                    y: trend_series[i]
                });
            }
        } else if(x_series[i] != undefined) {
            spacer_series.push({
                x:  x_series[i],
                y:  null
            });
        }
    }
    
    var plotting_series = [
        {
            name:           id,
            data:           prep_data,
            color:          palette.color(),
            renderer:       'line',
    		interpolation:  'basis',
        },
        {
            data:           spacer_series,
            renderer:       'line',
        }
    ];
    
    if(trend_series != undefined) {
        console.log('Have trend series!', trend_series);
        plotting_series.push({
            data:           prep_trend_data,
            color:          palette.color(),
            renderer:       'scatterplot',
            dotSize:        1
        });
    }
    
    // Plot
    var graph = new Rickshaw.Graph({
        element:    plot,
        renderer:   'multi',
        dotSize:    1,
        series:     plotting_series,
        width:      plot.offsetWidth,
        height:     plot.offsetHeight,
        min:        (def_min == undefined) ? (min - (max-min) * 0.2) : def_min,
        max:        (def_max == undefined) ? (max + (max-min) * 0.2) : def_max
    });
    
    var x_axis = new Rickshaw.Graph.Axis.X({ 
        graph:          graph,
        element:        x_axis_el,
        orientation:    'bottom',
        ticks:          20
    });
    var y_axis = new Rickshaw.Graph.Axis.Y({
        graph:          graph,
        orientation:    'left',
        //tickFormat:     Rickshaw.Fixtures.Number.formatKMBT,
        ticks:          10,
        element:        y_axis_el
    });
    var hoverDetail = new Rickshaw.Graph.HoverDetail({
    	graph:      graph,
        xFormatter: function(x) {
            return "Time: " + x.toFixed(1) + " minutes";
        },
        formatter:  function(series, x, y) {
            return (y.toFixed(1) + "&deg;C");
        }
    });
    
    graph.render();
};