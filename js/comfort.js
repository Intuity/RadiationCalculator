var Comfort = Comfort || {};

Comfort.reset = function() {
    // Reset raw data
    Comfort.raw_data.temperature_series = [];
    Comfort.raw_data.humidity_series = [];
    Comfort.raw_data.pressure_series = [];
    Comfort.raw_data.light_red_series = [];
    Comfort.raw_data.light_green_series = [];
    Comfort.raw_data.light_blue_series = [];
    Comfort.raw_data.light_clear_series = [];
    // Reset results
    Comfort.results.temp_rate_of_change = [];
    Comfort.results.temp_poi = [];
    Comfort.results.vapor_pressure = [];
    Comfort.results.absolute_humidity = [];
    Comfort.results.red_rate_of_change = [];
    Comfort.results.green_rate_of_change = [];
    Comfort.results.blue_rate_of_change = [];
    Comfort.results.clear_rate_of_change = [];
    Comfort.results.pmv_values = [];
    Comfort.results.ppd_values = [];
};

Comfort.append_raw_frame = function(temp, humd, pres, red, green, blue, clear) {
    // If undefined, then mark as NULL value
    temp = (temp == undefined) ? null : temp;
    humd = (humd == undefined) ? null : humd;
    pres = (pres == undefined) ? null : pres;
    red     = (red      == undefined) ? null : red;
    green   = (green    == undefined) ? null : green;
    blue    = (blue     == undefined) ? null : blue;
    clear   = (clear    == undefined) ? null : clear;
    // Append the frame
    Comfort.raw_data.temperature_series.push(temp);
    Comfort.raw_data.humidity_series.push(humd);
    Comfort.raw_data.pressure_series.push(pres);
    Comfort.raw_data.light_red_series.push(red);
    Comfort.raw_data.light_green_series.push(green);
    Comfort.raw_data.light_blue_series.push(blue);
    Comfort.raw_data.light_clear_series.push(clear);
};

// Find points lying a certain number of standard deviations away from the mean,
// looks either only peak points or all points over boundary
Comfort.find_series_poi = function(series, start_date, end_date, num_std_dev, all_points, exclude_sunlight, upper_bound, lower_bound) {
    if(num_std_dev == undefined) num_std_dev = 2;
    if(all_points == undefined) all_points = false;
    if(exclude_sunlight == undefined) exclude_sunlight = true;
    if(upper_bound == undefined || lower_bound == undefined) {
        // Find mean of the series
        var summation = 0;
        var summed_pt = 0;
        for(var i = 0; i < series.length; i++) {
            var timepoint = Math.floor((i / series.length) * (end_date - start_date) + start_date);
            if(exclude_sunlight && Comfort.Sunlight.is_date_in_sunlight(timepoint)) continue;
            summation += series[i];
            summed_pt++;
        }
        var mean = summation / summed_pt;
        // Find variance & standard deviation of the series
        summation = 0;
        for(var i = 0; i < series.length; i++) {
            var timepoint = Math.floor((i / series.length) * (end_date - start_date) + start_date);
            if(exclude_sunlight && Comfort.Sunlight.is_date_in_sunlight(timepoint)) continue;
            summation += Math.pow((series[i] - mean), 2);
        }
        var variance = summation / summed_pt;
        var std_dev = Math.sqrt(variance);
        console.log('Mean %s, Variance %s, Std.Dev. %s, Summed Pts %s, Total Pts', mean, variance, std_dev, summed_pt, series.length);
        // Define upper/lower search boundaries
        upper_bound = mean + num_std_dev*std_dev;
        lower_bound = mean - num_std_dev*std_dev;
    }
    // Now search for points
    var poi = [];
    var current_peak_index = null;
    var current_peak_value = null;
    for(var i = 0; i < series.length; i++) {
        var timepoint = Math.floor((i / series.length) * (end_date - start_date) + start_date);
        if(exclude_sunlight && Comfort.Sunlight.is_date_in_sunlight(timepoint)) {
            if(current_peak_index != null) poi.push(current_peak_index);
            current_peak_index = null;
            current_peak_value = null;
            continue;
        }
        var val = series[i];
        if(val >= upper_bound) {
            if(all_points) {
                poi.push(i);
            // No prior peak value
            } else if(current_peak_index == null) {
                current_peak_index = i;
                current_peak_value = val;
            // Had a sign change, prior peak was below lower
            } else if(current_peak_value < lower_bound) {
                poi.push(current_peak_index);
                current_peak_index = i;
                current_peak_value = val;
            // Value being tested is actually higher than our peak estimate
            } else if(val > current_peak_value) {
                current_peak_index = i;
                current_peak_value = val;
            }
        } else if(val <= lower_bound) {
            if(all_points) {
                poi.push(i);
            // No prior peak value
            } else if(current_peak_index == null) {
                current_peak_index = i;
                current_peak_value = val;
            // Had a sign change, prior peak was above upper
            } else if(current_peak_value > upper_bound) {
                poi.push(current_peak_index);
                current_peak_index = i;
                current_peak_value = val;
            // Value being tested is actually lower than our peak estimate
            } else if(val < current_peak_value) {
                current_peak_index = i;
                current_peak_value = val;
            }
        } else if(val > lower_bound && val < upper_bound && !all_points) {
            // We have moved outside of the region of the peak
            if(current_peak_index != null) {
                poi.push(current_peak_index);
                current_peak_index = current_peak_value = null;
            }
        }
    }
    // Push in the last peak if remaining
    if(current_peak_index != null && !all_points) {
        poi.push(current_peak_index);
    }
    return poi;
};

// Calculates the rate of change of temperature from the provided data
Comfort.calculate_temperature_rate_of_change = function() {
    // Work out the time step between points
    var time_step = (Comfort.raw_data.end_date - Comfort.raw_data.start_date) / (Comfort.raw_data.temperature_series.length * 1000 * 3600); // In hours
    // Setup variables to accumulate rates
    Comfort.results.temp_rate_of_change = [];
    Comfort.results.temp_rate_of_change.push(0);
    // Work out rates
    for(var i = 1; i < (Comfort.raw_data.temperature_series.length - 1); i++) {
        var change = Comfort.raw_data.temperature_series[i+1] - Comfort.raw_data.temperature_series[i-1];
        Comfort.results.temp_rate_of_change.push(change / time_step);
    }
    // Identify PoI at 1st and 2nd standard deviations
    Comfort.results.temp_poi_1st_stddev = Comfort.find_series_poi(
        Comfort.results.temp_rate_of_change, 
        Comfort.raw_data.start_date, 
        Comfort.raw_data.end_date, 
        1, false, false
    );
    Comfort.results.temp_poi_2nd_stddev = Comfort.find_series_poi(
        Comfort.results.temp_rate_of_change, 
        Comfort.raw_data.start_date, 
        Comfort.raw_data.end_date, 
        2, false, false
    );
};

// Calculates the rate of change of light levels from the provided data
Comfort.calculate_light_rate_of_change = function() {
    var time_step = (Comfort.raw_data.end_date - Comfort.raw_data.start_date) / (Comfort.raw_data.light_red_series.length * 60 * 1000); // In minutes
    Comfort.results.red_rate_of_change = [];
    Comfort.results.green_rate_of_change = [];
    Comfort.results.blue_rate_of_change = [];
    Comfort.results.clear_rate_of_change = [];
    Comfort.results.red_rate_of_change.push(0);
    Comfort.results.green_rate_of_change.push(0);
    Comfort.results.blue_rate_of_change.push(0);
    Comfort.results.clear_rate_of_change.push(0);
    for(var i = 1; i < (Comfort.raw_data.light_red_series.length - 1); i++) {
        if(Comfort.raw_data.light_red_series[i - 1] != undefined && Comfort.raw_data.light_red_series[i + 1] != undefined) {
            Comfort.results.red_rate_of_change.push((Comfort.raw_data.light_red_series[i+1] - Comfort.raw_data.light_red_series[i-1]) / time_step);
        }
        if(Comfort.raw_data.light_green_series[i - 1] != undefined && Comfort.raw_data.light_green_series[i + 1] != undefined) {
            Comfort.results.green_rate_of_change.push((Comfort.raw_data.light_green_series[i+1] - Comfort.raw_data.light_green_series[i-1]) / time_step);
        }
        if(Comfort.raw_data.light_blue_series[i - 1] != undefined && Comfort.raw_data.light_blue_series[i + 1] != undefined) {
            Comfort.results.blue_rate_of_change.push((Comfort.raw_data.light_blue_series[i+1] - Comfort.raw_data.light_blue_series[i-1]) / time_step);
        }
        if(Comfort.raw_data.light_clear_series[i - 1] != undefined && Comfort.raw_data.light_clear_series[i + 1] != undefined) {
            Comfort.results.clear_rate_of_change.push((Comfort.raw_data.light_clear_series[i+1] - Comfort.raw_data.light_clear_series[i-1]) / time_step);
        }
    }
    // Find each series' points of interest
    Comfort.results.red_poi_1st_stddev = Comfort.find_series_poi(
        Comfort.results.red_rate_of_change, 
        Comfort.raw_data.start_date, 
        Comfort.raw_data.end_date, 
        1, false, true,
        +5, -5
    );
    Comfort.results.red_poi_2nd_stddev = Comfort.find_series_poi(
        Comfort.results.red_rate_of_change, 
        Comfort.raw_data.start_date, 
        Comfort.raw_data.end_date, 
        2, false, true,
        +5, -5
    );
    Comfort.results.green_poi_1st_stddev = Comfort.find_series_poi(
        Comfort.results.green_rate_of_change, 
        Comfort.raw_data.start_date, 
        Comfort.raw_data.end_date, 
        1, false, true,
        +5, -5
    );
    Comfort.results.green_poi_2nd_stddev = Comfort.find_series_poi(
        Comfort.results.green_rate_of_change, 
        Comfort.raw_data.start_date, 
        Comfort.raw_data.end_date, 
        2, false, true,
        +5, -5
    );
    Comfort.results.blue_poi_1st_stddev = Comfort.find_series_poi(
        Comfort.results.blue_rate_of_change, 
        Comfort.raw_data.start_date, 
        Comfort.raw_data.end_date, 
        1, false, true,
        +5, -5
    );
    Comfort.results.blue_poi_2nd_stddev = Comfort.find_series_poi(
        Comfort.results.blue_rate_of_change, 
        Comfort.raw_data.start_date, 
        Comfort.raw_data.end_date, 
        2, false, true,
        +5, -5
    );
    Comfort.results.clear_poi_1st_stddev = Comfort.find_series_poi(
        Comfort.results.clear_rate_of_change, 
        Comfort.raw_data.start_date, 
        Comfort.raw_data.end_date, 
        1, false, true,
        +5, -5
    );
    Comfort.results.clear_poi_2nd_stddev = Comfort.find_series_poi(
        Comfort.results.clear_rate_of_change, 
        Comfort.raw_data.start_date, 
        Comfort.raw_data.end_date, 
        2, false, true,
        +5, -5
    );
};

Comfort.estimate_occupied_percentage = function(threshold) {
    threshold = (threshold == undefined) ? 5 : threshold;
    var occupied_points = 0;
    var non_sunlit_points = 0;
    var time_diff = (Comfort.raw_data.end_date - Comfort.raw_data.start_date);
    var start_time = Comfort.raw_data.start_date;
    for(var i = 0; i < Comfort.raw_data.light_clear_series.length; i++) {
        var timepoint = Math.floor((i / Comfort.raw_data.light_clear_series.length) * time_diff + start_time);
        if(!Comfort.Sunlight.is_date_in_sunlight(timepoint)) {
            if(Comfort.raw_data.light_clear_series[i] > threshold) occupied_points += 1;
            non_sunlit_points += 1;
        }
    }
    return 100.0 * (occupied_points / non_sunlit_points);
};

Comfort.estimate_room_occupation = function() {
    var data_series = Comfort.raw_data.light_clear_series;
    var rate_series = Comfort.results.clear_rate_of_change;
    var poi_series = Comfort.results.clear_poi_1st_stddev;
    var time_diff = (Comfort.raw_data.end_date - Comfort.raw_data.start_date);
    var start_time = Comfort.raw_data.start_date;
    // Work out the mean, artificial, illuminated brightness
    var summation = 0;
    var summed_pts = 0;
    for(var i = 0; i < Comfort.raw_data.light_clear_series.length; i++) {
        var timepoint = Math.floor((i / data_series.length) * time_diff + start_time);
        if(!Comfort.Sunlight.is_date_in_sunlight(timepoint) && Comfort.raw_data.light_clear_series[i] > 5) {
            summation += Comfort.raw_data.light_clear_series[i];
            summed_pts++;
        }
    }
    // Work through the points of interest
    var occupied_threshold = (summation / summed_pts);
    console.log('Mean occupied brightness: %s', occupied_threshold);
    Comfort.results.occupation_events = [];
    for(var i = 0; i < poi_series.length; i++) {
        var poi_index = poi_series[i];
        var timepoint = Math.floor((poi_index / data_series.length) * time_diff + start_time);
        var poi_value = rate_series[poi_index];
        if(poi_value > 0) { // Potentially have a switch ON
            var vote = 0;
            if((poi_index < (data_series.length - 1)) ? (data_series[poi_index + 1] > occupied_threshold) : true) vote++;
            if((data_series[poi_index] > occupied_threshold)) vote++;
            if((poi_index > 0) ? (data_series[poi_index - 1] < occupied_threshold) : true) vote++;
            console.log('Testing For Entrance: %s Vote: %s', new Date(timepoint), vote);
            if(vote >= 2) {
                // Yep, that was a switch ON
                Comfort.results.occupation_events.push({
                    type:   'entry',
                    date:   new Date(timepoint)
                });
            }
            
        } else if(poi_value < 0) { // Potentially have a switch OFF
            var vote = 0;
            if((poi_index < (data_series.length - 1)) ? (data_series[poi_index + 1] < occupied_threshold) : true) vote++;
            if((data_series[poi_index] < occupied_threshold)) vote++;
            if((poi_index > 0) ? (data_series[poi_index - 1] > occupied_threshold) : true) vote++;
            console.log('Testing For Exit: %s Vote: %s', new Date(timepoint), vote);
            if(vote >= 2) {
                // Yep, that was a switch OFF
                Comfort.results.occupation_events.push({
                    type:   'exit',
                    date:   new Date(timepoint)
                });
            }
            
        }
    }
    var _plot_estimate = function(id) {
        // Now plot room estimation
        var holder = document.getElementById(id);
        holder.innerHTML = '';
        for(var i = 0; i < Comfort.results.occupation_events.length; i++) {
            var evt = Comfort.results.occupation_events[i];
            var element = document.createElement('div');
            element.setAttribute('class', 'event');
            var prop = (evt.date.getTime() - Comfort.raw_data.start_date) / (Comfort.raw_data.end_date - Comfort.raw_data.start_date);
            element.style.left = (prop * 100.0) + '%';
            var icon = document.createElement('i');
            if(evt.type == 'entry') icon.setAttribute('class', 'fa fa-sign-in');
            else if(evt.type == 'exit') icon.setAttribute('class', 'fa fa-sign-out');
            element.appendChild(icon);
            holder.appendChild(element);
        }
    };
    _plot_estimate('entry_exit_events');
    _plot_estimate('summary_occupancy_events');
};

// Calculate the Predicted Mean Vote (PMV) thermal scale (Fanger).
// This version just uses flat estimates of the parameters, rather
// than adjusting them over time to compensate for changes in the
// occupant's behaviour.
Comfort.run_flat_calculation = function() {
    // - Calculate sunlight exclusion periods
    Comfort.Sunlight.calculate_sunlight_periods();
    // - Run the humidity statistic calculations
    Comfort.Fanger.calculate_humidity_stats();
    // - Calculate the temperature rate of change
    Comfort.calculate_temperature_rate_of_change();
    Comfort.plot_points_of_interest(
        'temperature', 
        Comfort.results.temp_rate_of_change, 
        Comfort.results.temp_poi_1st_stddev, 'fa-circle-o', '#999',
        Comfort.results.temp_poi_2nd_stddev, 'fa-circle-o', '#000'
    );
    Comfort.plot_points_of_interest(
        'summary_temperature', 
        Comfort.results.temp_rate_of_change, 
        Comfort.results.temp_poi_1st_stddev, 'polarity', '#000'
    );
    // - Calculate the light levels rates of change
    Comfort.calculate_light_rate_of_change();
    Comfort.plot_points_of_interest(
        'red_light', 
        Comfort.results.red_rate_of_change, 
        Comfort.results.red_poi_1st_stddev, 'fa-circle-o', '#FAA',
        Comfort.results.red_poi_2nd_stddev, 'fa-circle-o', '#F00'
    );
    Comfort.plot_points_of_interest(
        'green_light', 
        Comfort.results.green_rate_of_change, 
        Comfort.results.green_poi_1st_stddev, 'fa-circle-o', '#AFA',
        Comfort.results.green_poi_2nd_stddev, 'fa-circle-o', '#0F0'
    );
    Comfort.plot_points_of_interest(
        'blue_light', 
        Comfort.results.blue_rate_of_change, 
        Comfort.results.blue_poi_1st_stddev, 'fa-circle-o', '#AAF',
        Comfort.results.blue_poi_2nd_stddev, 'fa-circle-o', '#00F'
    );
    Comfort.plot_points_of_interest(
        'clear_light', 
        Comfort.results.clear_rate_of_change, 
        Comfort.results.clear_poi_1st_stddev, 'fa-circle-o', '#999',
        Comfort.results.clear_poi_2nd_stddev, 'fa-circle-o', '#000'
    );
    // - Calculate and plot occupancy events
    Comfort.estimate_room_occupation();
    // - Now calculate the PMV & PPD values
    /*Comfort.results.pmv_values = [];
    Comfort.results.ppd_values = [];
    Comfort.Fanger.calculate_pmv_ppd_series(
        Comfort.raw_data.temperature_series,
        Comfort.raw_data.humidity_series,
        Comfort.raw_data.air_velocity,
        Comfort.raw_data.clothing_insulation,
        Comfort.raw_data.metabolic_rate,
        Comfort.raw_data.external_work,
        true
    );*/
    Comfort.Subjects.calculate_models_comfort();
};

// Run time based calculation of variations in metabolic rate & 
// clothing factor of the occupant of the room. This is to give
// a more informed set of PMV values that adjust over time.
Comfort.run_schedule_based_calculation = function() {
    // Prepare the data series to feed into the calculation
    // - Create the series stores
    var air_vel = [];
    var ins_cloth = [];
    var met_rate = [];
    var ext_work = [];
    // - Extra parameters
    var start_date = Comfort.raw_data.start_date;
    var series_length = Comfort.raw_data.temperature_series.length
    var date_diff = Comfort.raw_data.end_date - Comfort.raw_data.start_date;
    for(var i = 0; i < series_length; i++) {
        var date = new Date(Math.floor((i / series_length) * (date_diff) + start_date));
        var hour_dec = date.getHours() + (date.getMinutes() / 60.0);
        if(hour_dec < 0.0 || hour_dec > 24.0) hour_dec = 0; // Limit it sensibly
        // Find the correct point in the schedule
        var sched_pt = null;
        for(var j = 0; j < Comfort.parameter_schedule.length; j++) {
            if(hour_dec >= Comfort.parameter_schedule[j].start_hour && hour_dec < Comfort.parameter_schedule[j].end_hour) {
                sched_pt = Comfort.parameter_schedule[j];
                break;
            }
        }
        // If we didn't find an applicable point in the schedule, used default values
        if(sched_pt == null) {
            air_vel.push(Comfort.raw_data.air_velocity);
            ins_cloth.push(Comfort.raw_data.clothing_insulation);
            met_rate.push(Comfort.raw_data.metabolic_rate);
            ext_work.push(Comfort.raw_data.external_work);
            continue;
        // Else populate with schedule values
        } else {
            air_vel.push(Comfort.raw_data.air_velocity); // Not in schedule
            ins_cloth.push((sched_pt.clothing_insulation != null) ? sched_pt.clothing_insulation : Comfort.raw_data.clothing_insulation);
            met_rate.push((sched_pt.metabolic_rate != null) ? sched_pt.metabolic_rate : Comfort.raw_data.metabolic_rate);
            ext_work.push(Comfort.raw_data.external_work); // Not in schedule
        }
    }
    // Clear results
    Comfort.results.sched_pmv_values = [];
    Comfort.results.sched_ppd_values = [];
    // Run the humidity statistic calculations
    Comfort.Fanger.calculate_humidity_stats();
    // Run PMV/PPD calculation
    var result = Comfort.Fanger.calculate_pmv_ppd_series(
        Comfort.raw_data.temperature_series,
        Comfort.raw_data.humidity_series,
        air_vel,
        ins_cloth,
        met_rate,
        ext_work,
        false
    );
    for(var i = 0; i < result.length; i++) {
        var pt = result[i];
        Comfort.results.sched_pmv_values.push((pt == null) ? null : pt.PMV);
        Comfort.results.sched_ppd_values.push((pt == null) ? null : pt.PPD);
    }
};

// Break the PMV parameter schedule into its sections and summarise
// the level of comfort in the room over the full available data.
// This requires the sched_pmv_values/sched_ppd_values to be already
// generated.
Comfort.calculate_comfort_summary = function() {
    // Create a bin for each of the schedule slots
    var bins = [];
    for(var i = 0; i < Comfort.parameter_schedule.length; i++) { bins.push([]); }
    // Work through the generated PMV/PPD values & sort into bins
    var start_date = Comfort.raw_data.start_date;
    var series_length = Comfort.raw_data.temperature_series.length
    var date_diff = Comfort.raw_data.end_date - Comfort.raw_data.start_date;
    for(var i = 0; i < series_length; i++) {
        var date = new Date(Math.floor((i / series_length) * (date_diff) + start_date));
        var hour_dec = date.getHours() + (date.getMinutes() / 60.0);
        if(hour_dec < 0.0 || hour_dec > 24.0) hour_dec = 0; // Limit it sensibly
        // Find the correct point in the schedule
        var bin_index = -1;
        for(var j = 0; j < Comfort.parameter_schedule.length; j++) {
            if(hour_dec >= Comfort.parameter_schedule[j].start_hour && hour_dec < Comfort.parameter_schedule[j].end_hour) {
                bin_index = j;
                break;
            }
        }
        if(bin_index >= 0 && bin_index < bins.length) {
            bins[bin_index].push({
                PMV:    Comfort.results.sched_pmv_values[i],
                PPD:    Comfort.results.sched_ppd_values[i]
            });
        }
    }
    // For each bin, work out the means
    var pmv_means = [];
    var ppd_means = [];
    for(var i = 0; i < bins.length; i++) {
        var pmv_sum = 0;
        var pmv_points = 0;
        var ppd_sum = 0;
        var ppd_points = 0;
        for(var j = 0; j < bins[i].length; j++) {
            pmv_sum += (bins[i][j].PMV != null) ? bins[i][j].PMV : 0;
            pmv_points += (bins[i][j].PMV != null) ? 1 : 0;
            ppd_sum += (bins[i][j].PPD != null) ? bins[i][j].PPD : 0;
            ppd_points += (bins[i][j].PPD != null) ? 1 : 0;
        }
        pmv_means.push((pmv_points > 0) ? (pmv_sum / pmv_points) : null);
        ppd_means.push((ppd_points > 0) ? (ppd_sum / ppd_points) : null);
    }
    // Classify the mean values for each of the bins to say what level
    // of acceptibility it has for a resident.
    var classifications = [];
    var class_box = document.getElementById('sched_summary');
    if(class_box) class_box.innerHTML = '';
    for(var i = 0; i < bins.length; i++) {
        var pmv_mean = pmv_means[i];
        var ppd_mean = ppd_means[i];
        var gte_zero = (pmv_mean >= 0);
        // Find the right classification
        var clf = null;
        for(var j = 0; j < Comfort.comfort_classifications.length; j++) {
            var test = Comfort.comfort_classifications[j];
            if(test.gte_zero_pmv == gte_zero) {
                if(ppd_mean >= test.min_ppd && ppd_mean <= test.max_ppd) {
                    clf = test;
                    break;
                }
            }
        }
        if(clf == null) continue;
        // Fill in the classification
        var sched_item = Comfort.parameter_schedule[i];
        classifications.push({
            pmv_mean:       pmv_mean,
            ppd_mean:       ppd_mean,
            schedule:       sched_item.description,
            description:    clf.description,
            color:          clf.color
        });
        if(class_box) {
            var title = document.createElement('strong');
            title.innerHTML = sched_item.description + ': ';
            var icon = document.createElement('i');
            icon.setAttribute('class', 'fa fa-circle');
            icon.style.color = clf.color;
            var text = document.createElement('span');
            text.innerHTML = '&ensp;' + clf.description + '&emsp;';
            var br = document.createElement('br');
            class_box.appendChild(title);
            class_box.appendChild(icon);
            class_box.appendChild(text);
            class_box.appendChild(br);
        }
    }
    return classifications;
};

Comfort.plot_light_levels_graph = function() {
    var _plot_multi_series = function(id, start_date, end_date, red_series, green_series, blue_series, clear_series, def_min, def_max, use_colour_strip) {
        // Get the elements
        var holder = document.getElementById(id + '_plot_holder');
        var plot = document.getElementById(id + '_plot');
        var y_axis_el = document.getElementById(id + '_plot_y_axis');
        var colour_strip = null;
        if(use_colour_strip) {
            colour_strip = document.getElementById('light_colour_strip');
            colour_strip.innerHTML = '';
        }
        // Clear any previous plot
        plot.innerHTML = y_axis_el.innerHTML = '';
        // Find longest series
        var max_length = red_series.length;
        if(max_length < green_series.length) max = green_series.length;
        if(max_length < blue_series.length) max = blue_series.length;
        if(max_length < clear_series.length) max = clear_series.length;
        // Calculate the width of the colour strip
        if(use_colour_strip) {
            var colour_strip_width = (100.0 / max_length) + '%';
        }
        // Prepare series to plot
        var red_plot_series = [];
        var green_plot_series = [];
        var blue_plot_series = [];
        var clear_plot_series = [];
        var max = null;
        var min = null;
        for(var i = 0; i < max_length; i++) {
            var timepoint = Math.floor(((i / max_length) * (end_date - start_date) + start_date) / 1000.0);
            var red_val = red_series[i];
            var green_val = green_series[i];
            var blue_val = blue_series[i];
            var clear_val = clear_series[i];
            if(red_val != undefined) {
                if(min == undefined || red_val < min) min = red_val;
                if(max == undefined || red_val > max) max = red_val;
                red_plot_series.push({
                    x:  timepoint,
                    y:  red_val
                });
            }
            if(green_val != undefined) {
                if(min == undefined || green_val < min) min = green_val;
                if(max == undefined || green_val > max) max = green_val;
                green_plot_series.push({
                    x:  timepoint,
                    y:  green_val
                });
            }
            if(blue_val != undefined) {
                if(min == undefined || blue_val < min) min = blue_val;
                if(max == undefined || blue_val > max) max = blue_val;
                blue_plot_series.push({
                    x:  timepoint,
                    y:  blue_val
                });
            }
            if(clear_val != undefined) {
                if(min == undefined || clear_val < min) min = clear_val;
                if(max == undefined || clear_val > max) max = clear_val;
                clear_plot_series.push({
                    x:  timepoint,
                    y:  clear_val
                });
            }
            // Calculate the colour
            if(use_colour_strip && red_val != undefined && green_val != undefined && blue_val != undefined && clear_val != undefined) {
                var rgb = '#000000';
                var max_val = 200;
                if(max_val > 0) {
                    var rgb_arr = [ Math.floor(255 * (red_val / max_val)), Math.floor(255 * (green_val / max_val)), Math.floor(255 * (blue_val / max_val)) ];
                    for(var c = 0; c < 3; c++) { if(rgb_arr[c] < 0) rgb_arr[c] = 0; else if(rgb_arr[c] > 255) rgb_arr[c] = 255 };
                    rgb = '#' + Comfort.bytes_to_hex(rgb_arr);
                }
                var el = document.createElement('div');
                el.style.width = colour_strip_width;
                el.style.position = 'absolute';
                el.style.left = ((i / max_length) * 100.0) + '%';
                el.style.height = '38px';
                el.style.backgroundColor = rgb;
                colour_strip.appendChild(el);
            }
        }
        if(def_min != undefined) min = def_min;
        if(def_max != undefined) max = def_max;
        // Plot
        var plot_series = [
            {
                name:   'light_red',
                data:   red_plot_series,
                color:  '#F00'
            },
            {
                name:   'light_green',
                data:   green_plot_series,
                color:  '#0F0'
            },
            {
                name:   'light_blue',
                data:   blue_plot_series,
                color:  '#00F'
            },
            {
                name:   'light_clear',
                data:   clear_plot_series,
                color:  '#000'
            }
        ];
        var graph = new Rickshaw.Graph({
            element:    plot,
            renderer:   'line',
    		interpolation: 'basis',
            series:     plot_series,
            width:      plot.offsetWidth,
            height:     plot.offsetHeight,
            min:        min,
            max:        max
        });
        
        var time_unit = null;
        var num_days = ((end_date - start_date) / (24*3600*1000));
        if(num_days <= 1) time_unit = 'hour';
        else if(num_days < 6) time_unit = '6 hour';
        else if(num_days >= 6) time_unit = 'day';
    
        var x_axis = new Rickshaw.Graph.Axis.Time({ 
            graph:          graph,
            timeUnit:       (new Rickshaw.Fixtures.Time()).unit(time_unit)
        });
        var y_axis = new Rickshaw.Graph.Axis.Y({
            graph:          graph,
            orientation:    'left',
            //tickFormat:     Rickshaw.Fixtures.Number.formatKMBT,
            ticks:          5,
            element:        y_axis_el
        });
    
        graph.render();
    };
    
    _plot_multi_series(
        'light_levels', Comfort.raw_data.start_date, Comfort.raw_data.end_date, 
        Comfort.raw_data.light_red_series, Comfort.raw_data.light_green_series, 
        Comfort.raw_data.light_blue_series, Comfort.raw_data.light_clear_series,
        0,
        1000,
        true
    );
    
    _plot_multi_series(
        'light_change', Comfort.raw_data.start_date, Comfort.raw_data.end_date, 
        Comfort.results.red_rate_of_change, Comfort.results.green_rate_of_change, 
        Comfort.results.blue_rate_of_change, Comfort.results.clear_rate_of_change,
        -20,
        20,
        false
    );
};

Comfort.plot_points_of_interest = function(id, data_series, first_order_poi, fo_symbol, fo_colour, second_order_poi, so_symbol, so_colour) {
    if(fo_symbol == undefined) fo_symbol = 'fa-circle-o';
    if(fo_colour == undefined) fo_colour = '#000';
    if(so_symbol == undefined) so_symbol = fo_symbol;
    if(so_colour == undefined) so_colour = fo_colour;
    var holder = document.getElementById(id + '_poi');
    holder.innerHTML = '';
    // Plot first orders
    for(var i = 0; i < first_order_poi.length; i++) {
        var pt = document.createElement('div');
        pt.setAttribute('class', 'marker');
        pt.style.color = fo_colour;
        pt.style.left = ((first_order_poi[i] / data_series.length) * 100.0) + '%';
        var icon = document.createElement('i');
        if(fo_symbol == 'polarity') {
            icon.setAttribute('class', 'fa ' + ((data_series[first_order_poi[i]] >= 0) ? 'fa-arrow-circle-o-up' : 'fa-arrow-circle-o-down'));
        } else {
            icon.setAttribute('class', 'fa ' + fo_symbol);
        }
        pt.appendChild(icon);
        holder.appendChild(pt);
    }
    if(second_order_poi != undefined) {
        // Plot second orders
        for(var i = 0; i < second_order_poi.length; i++) {
            var pt = document.createElement('div');
            pt.setAttribute('class', 'marker second');
            pt.style.color = so_colour;
            pt.style.left = ((second_order_poi[i] / data_series.length) * 100.0) + '%';
            var icon = document.createElement('i');
            if(so_symbol == 'polarity') {
                icon.setAttribute('class', 'fa ' + ((data_series[first_order_poi[i]] >= 0) ? 'fa-arrow-circle-o-up' : 'fa-arrow-circle-o-down'));
            } else {
                icon.setAttribute('class', 'fa ' + so_symbol);
            }
            pt.appendChild(icon);
            holder.appendChild(pt);
        }
    }
};

// Plot the graphs for various series
Comfort.plot_graphs = function() {
    var palette = new Rickshaw.Color.Palette();
    var _plot_graph = function(id, start_date, end_date, series, def_min, def_max) {
        // Get the important elements
        var holder = document.getElementById(id + '_holder');
        var plot = document.getElementById(id);
        var y_axis_el = document.getElementById(id + '_y_axis');
        // Clear any previous plot
        plot.innerHTML = y_axis_el.innerHTML = '';
        // Prepare the data to plot
        var prep_data = [];
        var min = def_min;
        var max = def_max;
        for(var i = 0; i < series.length; i++) {
            if(series[i] == undefined) continue;
            if(def_min == undefined && (min == undefined || series[i] < min)) min = series[i];
            if(def_max == undefined && (max == undefined || series[i] > max)) max = series[i];
            prep_data.push({
                // Has to be in seconds, not milliseconds
                x:  Math.floor(((i / series.length) * (end_date - start_date) + start_date) / 1000.0),
                y:  series[i]
            });
        }
        
        // Plot
        var graph = new Rickshaw.Graph({
            element:    plot,
            renderer:   'line',
    		interpolation: 'basis',
            series:     [
                {
                    name:   id,
                    data:   prep_data,
                    color:  palette.color()
                }
            ],
            width:      plot.offsetWidth,
            height:     plot.offsetHeight,
            min:        min,
            max:        max
        });
        
        var time_unit = null;
        var num_days = ((Comfort.raw_data.end_date - Comfort.raw_data.start_date) / (24*3600*1000));
        if(num_days <= 1) time_unit = 'hour';
        else if(num_days < 6) time_unit = '6 hour';
        else if(num_days >= 6) time_unit = 'day';
        
        var x_axis = new Rickshaw.Graph.Axis.Time({ 
            graph:          graph,
            timeUnit:       (new Rickshaw.Fixtures.Time()).unit(time_unit)
        });
        var y_axis = new Rickshaw.Graph.Axis.Y({
            graph:          graph,
            orientation:    'left',
            //tickFormat:     Rickshaw.Fixtures.Number.formatKMBT,
            ticks:          5,
            element:        y_axis_el
        });
        
        graph.render();
    };
    // Plot the graphs
    _plot_graph('temperature_plot', Comfort.raw_data.start_date, Comfort.raw_data.end_date, Comfort.raw_data.temperature_series);
    _plot_graph('temp_change_plot', Comfort.raw_data.start_date, Comfort.raw_data.end_date, Comfort.results.temp_rate_of_change, -2, +2);
    _plot_graph('rel_humd_plot', Comfort.raw_data.start_date, Comfort.raw_data.end_date, Comfort.raw_data.humidity_series);
    _plot_graph('abs_humd_plot', Comfort.raw_data.start_date, Comfort.raw_data.end_date, Comfort.results.absolute_humidity);
    //_plot_graph('pmv_plot', Comfort.raw_data.start_date, Comfort.raw_data.end_date, Comfort.results.pmv_values, -4, +3);
    //_plot_graph('ppd_plot', Comfort.raw_data.start_date, Comfort.raw_data.end_date, Comfort.results.ppd_values, -20, 120);
    _plot_graph('sched_pmv_plot', Comfort.raw_data.start_date, Comfort.raw_data.end_date, Comfort.results.sched_pmv_values, -4, +3);
    _plot_graph('sched_ppd_plot', Comfort.raw_data.start_date, Comfort.raw_data.end_date, Comfort.results.sched_ppd_values, -20, 120);
    // Plot the light graph
    Comfort.plot_light_levels_graph();
};
