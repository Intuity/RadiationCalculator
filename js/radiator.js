var Calc = Calc || {};

Calc.Radiator = {};

// Calculate the Grashof (Gr) number for a vertical plate
// Inputs:
// char_length - the characteristic length of the plate (m)
// t_surface - the temperature of the plate (K)
// t_infinity - the temperature at some distance (K)
Calc.Radiator.calculate_grashof = function(
    char_length, t_surface, t_infinity
) {
    var t_film = (t_surface + t_infinity) / 2.0;
    var kin_visc = Calc.air_prop_at_temp('v', t_film);
    var t_delta = (t_surface - t_infinity);
    var gr_numerator = 9.81 * Math.pow(char_length, 3) * t_delta;
    var gr_denominator = Math.pow(kin_visc, 2) * t_film;
    var Gr = (gr_numerator / gr_denominator);
    return Gr;
};

// Look up the Prandtl (Pr) number for the particular temperature
Calc.Radiator.lookup_prandtl = function(t_film) {
    var Pr = Calc.air_prop_at_temp('pr', t_film);
    return Pr;
};

// Calculate the Raleigh (Ra) number for a vertical plate
// Inputs:
// char_length - the characteristic length of the plate (m)
// t_surface - the temperature of the plate (K)
// t_infinity - the temperature at some distance (K)
Calc.Radiator.calculate_raleigh = function(
    char_length, t_surface, t_infinity
) {
    var Gr = Calc.Radiator.calculate_grashof(char_length, t_surface, t_infinity);
    var Pr = Calc.Radiator.lookup_prandtl(0.5*(t_surface + t_infinity));
    var Ra = (Gr * Pr);
    return Ra;
};

// Calculate the Nusselt (Nu) number for a vertical plate
// Inputs:
// char_length - the characteristic length of the plate (m)
// t_surface - the temperature of the plate (K)
// t_infinity - the temperature at some distance (K)
Calc.Radiator.calculate_nusselt = function(
    char_length, t_surface, t_infinity
) {
    var Ra = Calc.Radiator.calculate_raleigh(char_length, t_surface, t_infinity);
    var Nu = ((Ra < 1E9) ? (0.59*Math.pow(Ra, 0.25)) : (0.1*Math.pow(Ra, (1/3))));
    return Nu;
};

// Calculate the convective heat transfer coefficient (h) in kW/m^2K
// Inputs:
// char_length - the characteristic length of the plate (m)
// t_surface - the temperature of the plate (K)
// t_infinity - the temperature at some distance (K)
Calc.Radiator.calculate_convective_coeff = function(
    char_length, t_surface, t_infinity
) {
    var Nu = Calc.Radiator.calculate_nusselt(char_length, t_surface, t_infinity);
    var t_film = (t_surface + t_infinity) / 2.0;
    var k = Calc.air_prop_at_temp('k', t_film);
    var h = (k * Nu) / char_length;
    return h;
};

// Calculate heat tranfer emitted by the radiator into the room by
// radiation
// Inputs:
// width - The width of the radiator (m)
// height - The height of the radiator (m)
// num_panels - The number of panels constructing the radiator
// num_fin_layers - The number of fin layers constructing the radiator
// t_rad - The temperature of the radiator surface (K)
// t_room - The temperature of the air in the room (K)
Calc.Radiator.calculate_radiated_heat = function(
    width, height, num_panels, num_fin_layers, t_rad, t_room
) {
    // We take that a panel has a nominal thickness of ~1cm, and
    // that panel spacings are ~8cm apart. Fin layers add an additional
    // ~3.5cm.
    var rad_faces_area = 2*width*height;        // Front and back of radiator
    // Work out the sides area
    var rad_thickness =  num_panels * 0.01;       // Panel thickness
    rad_thickness     += (num_panels - 1) * 0.08; // Spacings between panels
    if(num_panels == 1) rad_thickness += num_fin_layers * 0.035;
    else if(num_fin_layers > num_panels) rad_thickness += (num_fin_layers - num_panels) * 0.035;
    var rad_side_area = 2*(rad_thickness * height + rad_thickness * width);
    // Total area
    var rad_area = rad_faces_area + rad_side_area;
    
    // Calculate emission by radiation
    var emissivity = 0.9;
    var stefan_boltzmann = 5.6703E-8
    var temp_delta_4 = Math.pow(t_rad, 4) - Math.pow(t_room, 4);
    var Q = emissivity * stefan_boltzmann * rad_area * temp_delta_4;
    
    return Q;
};

// Calculate the heat emitted from the radiator into the room based on
// dimensions, # panels, # fin layers, temperatures
// Inputs:
// width - The width of the radiator (m)
// height - The height of the radiator (m)
// num_panels - The number of panels constructing the radiator
// num_fin_layers - The number of fin layers constructing the radiator
// t_rad - The temperature of the radiator surface (K)
// t_room - The temperature of the air in the room (K)
Calc.Radiator.calculate_heat_output = function(
    width, height, num_panels, num_fin_layers, t_rad, t_room
) {
    // First calculate the convective transfer coefficient
    var h = Calc.Radiator.calculate_convective_coeff(height, t_rad, t_room);
    
    // Work out the total surface area of the radiator - we consider panels
    // to be thin (i.e no depth) and fins to be of a standard thickness with
    // a small offset from the top and bottom of the radiator
    
    // Calculate the number of fins and their total area
    // - Some fin shape constants
    var fin_width = 0.01;   // m
    var fin_spacing = 0.01; // m
    var fin_depth = 0.035;  // m
    // - Work out the finned height of the radiator
    var fin_height = (height > 0.02) ? (height - 0.02) : 0; // Height less 2 cm, in m
    // - Work out the number of fins on the radiator
    //   + Width is less an inset to compensate for mounting brackets/structure/etc.
    var num_fins = Math.floor((width - 0.15) / (fin_width + fin_spacing));
    // - Work out the total fin surface area
    var per_fin_area = (fin_width + fin_depth * 2.0) * fin_height;
    var total_fin_area = num_fin_layers * num_fins * per_fin_area * 2; // Each fin has two sides!
    
    // Calculate the total panel area
    var total_panel_area = num_panels * (width * height) * 2; // Each panel has 2 sides!
    
    // Calculate the total area
    var total_area = total_fin_area + total_panel_area;
    
    // Calculate convective heat transfer per degree
    var conv_heat_per_deg = total_area * h * 1000.0; // in Watts
    
    // Calculate convective heat transfer from provided temperature delta
    var conv_heat_output = conv_heat_per_deg * (t_rad - t_room);
    
    // Calculate radiative heat transfer from the provided temperature delta
    var rdtd_heat_output = Calc.Radiator.calculate_radiated_heat(
        width, height, num_panels, num_fin_layers, t_rad, t_room
    );
    
    // Calculate total heat transfer
    var total_heat_output = conv_heat_output + rdtd_heat_output;
    
    return {
        fin_area:           total_fin_area,     // m^2
        panel_area:         total_panel_area,   // m^2
        area:               total_area,         // m^2
        convect_coeff:      h,                  // in kW/m^2K
        conv_heat_per_deg:  conv_heat_per_deg,  // W/K
        conv_heat_output:   conv_heat_output,   // W
        rdtd_heat_output:   rdtd_heat_output,   // W
        total_heat_output:  total_heat_output   // W
    };
};

