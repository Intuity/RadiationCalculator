var Comfort = Comfort || {};

Comfort.Sunlight = {};

// Sunrise/Sunset Calculations
Comfort.Sunlight.date_to_julian_date = function(date) {
    var date = (date instanceof Date) ? date.getTime() : parseInt(date);
    return Math.floor((date / (24*60*60*1000)) + 2440587.5);
};

Comfort.Sunlight.julian_date_to_date = function(julian) {
    var stamp = (julian - 2440587.5) * (24*60*60*1000);
    return (new Date(stamp));
};

// Calculate an estimate of the sunrise/sunset times for a specific day
Comfort.Sunlight.calculate_sunrise_sunset = function(date, latitude, longitude_west) {
    // Conver to Julian date
    var j_date = Comfort.Sunlight.date_to_julian_date(date);
    // Using algorithm from https://en.wikipedia.org/wiki/Sunrise_equation
    var pi_f = (Math.PI / 180.0);
    var n = j_date - 2451545.0 + 0.0008;
    var j_star = (longitude_west / 360.0) + n; // Mean solar noon
    var M = (357.5291 + 0.98560028 * j_star) % 360.0; // Mean solar anomaly
    var C = 1.9148*Math.sin(M * pi_f) + 
            0.0200*Math.sin(2 * M * pi_f) + 
            0.0003*Math.sin(3 * M * pi_f); // Equation of the center
    var lambda = (M + C + 180.0 + 102.9372) % 360.0; // Ecliptic Longitude
    var j_transit = 2451545.0 + j_star - (0.0053*Math.sin(M * pi_f) - 0.0069*Math.sin(2 * lambda * pi_f)); // Solar transit
    var sin_delta = Math.sin(lambda * pi_f) * Math.sin(23.44 * pi_f); // Declination of the Sun
    var cos_hour_angle = (Math.sin(-0.83 * pi_f) - Math.sin(latitude * pi_f) * sin_delta) / (Math.cos(latitude * pi_f) * Math.cos(Math.asin(sin_delta)));
    var hour_angle = Math.acos(cos_hour_angle) * (180 / Math.PI);
    var julian_set = j_transit + (hour_angle / 360.0);
    var julian_rise = j_transit - (hour_angle / 360.0);
    var set_date = Comfort.Sunlight.julian_date_to_date(julian_set);
    var rise_date = Comfort.Sunlight.julian_date_to_date(julian_rise);
    return {
        sunrise:    rise_date.getTime(),
        sunset:     set_date.getTime()
    };
};

// Calculate the periods of sunlight for the date range of data
Comfort.Sunlight.calculate_sunlight_periods = function() {
    var days = ((Comfort.raw_data.end_date - Comfort.raw_data.start_date)) / (24*3600*1000) + 1;
    var date = new Date(Comfort.raw_data.start_date);
    Comfort.results.sunlight_times = [];
    for(var i = 0; i <= days; i++) {
        Comfort.results.sunlight_times.push(Comfort.Sunlight.calculate_sunrise_sunset(
            date,
            52.207,
            -0.121 // West is positive, Cambridge is east of 0
        ));
        // Prep for next date
        date.setDate(date.getDate() + 1);
    }
};

Comfort.Sunlight.is_date_in_sunlight = function(date) {
    date = (date instanceof Date) ? date.getTime() : parseInt(date);
    var found = false;
    for(var i = 0; i < Comfort.results.sunlight_times.length; i++) {
        var day = Comfort.results.sunlight_times[i];
        if(date > (day.sunrise + 1800000) && date < (day.sunset - 1800000)) {
            found = true;
            break;
        }
    }
    return found;
};