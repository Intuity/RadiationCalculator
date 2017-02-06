var Comfort = Comfort || {};

Comfort.Subjects = {};

// A set of subject models for clothing and activity level
Comfort.Subjects.models = {
    naked:  {
        description:            'Naked',    
        metabolic_rate:         1.0,    // met
        external_work:          0,      // met
        air_velocity:           0.2,    // m/s
        clothing_insulation:    0       // clo
    },
    sleeping: {
        description:            'Sleeping With Autumn Weight Duvet',
        metabolic_rate:         0.8,    // met
        external_work:          0,      // met
        air_velocity:           0.2,    // m/s
        clothing_insulation:    6.8     // clo (10.5 tog, college duvets)
    },
    summer_sleeping: {
        description:            'Sleeping With Summer Weight Duvet',
        metabolic_rate:         0.8,    // met
        external_work:          0,      // met
        air_velocity:           0.2,    // m/s
        clothing_insulation:    2.9     // clo (4.5 tog)
    },
    office: {
        description:            'Office Work',
        metabolic_rate:         1.2,    // met
        external_work:          0,      // met
        air_velocity:           0.2,    // m/s
        clothing_insulation:    0.51    // clo
    },
    office_jumper: {
        description:            'Office Work + Jumper',
        metabolic_rate:         1.2,    // met
        external_work:          0,      // met
        air_velocity:           0.2,    // m/s
        clothing_insulation:    0.86    // clo
    },
    jumper: {
        description:            'Domestic Chores',
        metabolic_rate:         2.5,    // met
        external_work:          0,      // met
        air_velocity:           0.2,    // m/s
        clothing_insulation:    0.86    // clo
    },
    coat: {
        description:            'Outdoors (Walking)',
        metabolic_rate:         3.4,    // met
        external_work:          0,      // met
        air_velocity:           0.2,    // m/s
        clothing_insulation:    1.56    // clo
    },
    running: {
        description:            'Running',
        metabolic_rate:         8.0,    // met
        external_work:          0,      // met
        air_velocity:           0.2,    // m/s
        clothing_insulation:    0.19    // clo
    }
};

Comfort.Subjects.results = {};

Comfort.Subjects.calculate_point_comfort_level = function(
    model_key, temperature, humidity, velocity
) {
    if(Comfort.Subjects.models[model_key] == undefined) return undefined;
    
    var model = Comfort.Subjects.models[model_key];
    
    // Establish vapor pressure, air temp & mean radiant temp
    var pmv_ppd = Comfort.Fanger.ashrae_55_point_pmv_ppd(
        model.clothing_insulation, 
        model.metabolic_rate, 
        model.external_work, 
        temperature, 
        temperature, 
        (velocity != undefined) ? velocity : model.air_velocity, 
        humidity
    );
    
    return pmv_ppd;
};

Comfort.Subjects.calculate_models_comfort = function() {
    var model_keys = Object.keys(Comfort.Subjects.models);
    // Setup a generic plotting system
    var palette = new Rickshaw.Color.Palette();
    var _plot_graph = function(id, start_date, end_date, series, def_min, def_max) {
        // Get the important elements
        var holder = document.getElementById(id + '_holder');
        if(holder == undefined) return;
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
            if(min == undefined || series[i] < min) min = series[i];
            if(max == undefined || series[i] > max) max = series[i];
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
            min:        (def_min < min) ? def_min : min,
            max:        (def_max > max) ? def_max : max
        });
        
        var time_unit = null;
        var num_days = ((Comfort.raw_data.end_date - Comfort.raw_data.start_date) / (24*3600*1000));
        if(num_days <= 1) time_unit = 'hour';
        else if(num_days < 5) time_unit = '6 hour';
        else if(num_days >= 5) time_unit = 'day';
        
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

    // For each model calculate the comfort level, store it and plot it
    for(var i = 0; i < model_keys.length; i++) {
        var model = Comfort.Subjects.models[model_keys[i]];
        var pmv_ppd = Comfort.Fanger.calculate_pmv_ppd_series(
            Comfort.raw_data.temperature_series,
            Comfort.raw_data.humidity_series,
            model.air_velocity,         // 0.1 m/s air velocity
            model.clothing_insulation,  // in clo
            model.metabolic_rate * 58,  // function takes it as metric
            model.external_work * 58,   // again in met -> metric
            false                       // Don't push results into global store
        );
        Comfort.Subjects.results[model_keys[i]] = pmv_ppd;
        var PMV_series = [];
        var PPD_series = [];
        for(var j = 0; j < pmv_ppd.length; j++) { 
            if(pmv_ppd[j] == null) continue;
            PMV_series.push(pmv_ppd[j].PMV);
            PPD_series.push(pmv_ppd[j].PPD);
        }
        _plot_graph(
            'pmv_' + model_keys[i],
            Comfort.raw_data.start_date, Comfort.raw_data.end_date,
            PMV_series,
            -3, +3
        );
        _plot_graph(
            'ppd_' + model_keys[i],
            Comfort.raw_data.start_date, Comfort.raw_data.end_date,
            PPD_series,
            0, 100
        );
    }
};