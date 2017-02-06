var Comfort = Comfort || {};

// Clothing insulation values (in clo) can be sourced from the ASHRAE
// handbook, but a list of values is shown at:
// https://en.wikipedia.org/wiki/Clothing_insulation

// Metabolic rates (in Met and W/m^2) can be found at:
// http://www.engineeringtoolbox.com/met-metabolic-rate-d_733.html

// Explanation of units:
// 1 clo = 0.155 Km^2/W - unit of clothing insulation, 0 naked, 3 is full artic clothing
// 1 R = 0.176 Km^2/W, or 1 clo = 0.88 R - unit of insulation in residential/commercial construction
// 1 tog = 0.645 clo -  unit of duvet insulation, 3-4.5 tog is summer weight,
//                      7.5-10.5 tog is autumn weight, 12-13.5 tog is winter weight
// 1 Met = 58 W/m^2 - unit of metabolic rate, 1 Met is average rate whilst seating relaxed

Comfort.raw_data = {
    temperature_series:     [],
    humidity_series:        [],
    pressure_series:        [],
    light_red_series:       [],
    light_green_series:     [],
    light_blue_series:      [],
    light_clear_series:     [],
    start_date:             0,
    end_date:               0,
    // PMV parameters
    metabolic_rate:         100,     // 70 W/m^2 = 1.2 Met is the metabolic rate of a sedentary activity
    clothing_insulation:    0.82,   // 0.82 - socks, pants, trousers, long sleeve shirt, jumper
    air_velocity:           0.1,    // 0.1 m/s - air is basically still, no draft
    external_work:          0       // 0 W/m^2
};

Comfort.results = {
    sunlight_times:         [],
    temp_rate_of_change:    [],
    temp_poi_1st_stddev:    [],     // Indices of interest
    temp_poi_2nd_stddev:    [],     // Indices of interest
    vapor_pressure:         [],
    absolute_humidity:      [],
    red_rate_of_change:     [],
    red_poi_1st_stddev:     [],
    red_poi_2nd_stddev:     [],
    green_rate_of_change:   [],
    green_poi_1st_stddev:   [],
    green_poi_2nd_stddev:   [],
    blue_rate_of_change:    [],
    blue_poi_1st_stddev:    [],
    blue_poi_2nd_stddev:    [],
    clear_rate_of_change:   [],
    clear_poi_1st_stddev:   [],
    clear_poi_2nd_stddev:   [],
    occupation_events:      [],
    pmv_values:             [],
    ppd_values:             [],
    sched_pmv_values:       [],
    sched_ppd_values:       []
};

// A schedule for PMV/PPD calculations to vary the parameters of
// metabolic rate and clothing level of the occupants over the 
// course of the day.
// Schedule uses data from:
// 1) https://en.wikipedia.org/wiki/Clothing_insulation
// 2) http://www.engineeringtoolbox.com/met-metabolic-rate-d_733.html
// 3) https://en.wikipedia.org/wiki/Tog_(unit)
Comfort.parameter_schedule = [
    // Sleeping - early hours
    {
        description:            "Early Hours - Sleeping",
        start_hour:             0,      // Midnight
        end_hour:               6.5,    // 6:30 AM
        metabolic_rate:         46,     // 46 W/m^2 - Sleeping rate
        clothing_insulation:    3.225   // 3.225 clo - A summerweight duvet (~5 tog)
    },
    // Wake up/getting ready
    {
        description:            "Morning - Wake Up",
        start_hour:             6.5,    // 6:30 AM
        end_hour:               8.5,    // 8:30 AM
        metabolic_rate:         100,    // 100 W/m^2 - Sasic domestic work rate (shaving etc.)
        clothing_insulation:    0.57    // 0.57 clo - Long-sleeve pyjamas (thick)
    },
    // Morning work period - sedentary, working in room, dressed
    {
        description:            "Morning - Work",
        start_hour:             8.5,    // 8:30 AM
        end_hour:               12.5,   // 12:30 PM
        metabolic_rate:         70,     // 70 W/m^2 - Sedentary activity (office, dwelling, school, etc.)
        clothing_insulation:    1.01    // 1.01 clo - Trousers + long sleeved shirt & sweater
    },
    // Lunchtime - slightly more movement, same level of dress
    {
        description:            "Lunchtime",
        start_hour:             12.5,   // 12:30 PM
        end_hour:               14.0,   // 2 PM,
        metabolic_rate:         100,    // 100 W/m^2 - Basic domestic work rate
        clothing_insulation:    1.01    // 1.01 clo - Normal dress
    },
    // Afternoon/evening work period - sedentary, working in room, dressed
    {
        description:            "Afternoon/Early Evening - Work",
        start_hour:             14.0,   // 2 PM
        end_hour:               22.0,   // 10 PM
        metabolic_rate:         70,     // 100 W/m^2 - Sedentary activity
        clothing_insulation:    1.01    // 1.01 clo - Normal dress
    },
    // Late evening - period of relaxation
    {
        description:            "Late Evening - Relaxation",
        start_hour:             22.0,   // 2 PM
        end_hour:               23,     // 11 PM
        metabolic_rate:         58,     // 58 W/m^2 - Seated relaxed
        clothing_insulation:    0.57    // 0.57 clo - Pyjamas
    },
    // Sleeping - late hours
    {
        description:            "Late Hours - Sleeping",
        start_hour:             23,     // 11 PM
        end_hour:               24,     // Midnight
        metabolic_rate:         46,     // 46 W/m^2 - Sleeping rate
        clothing_insulation:    3.225   // 3.225 clo - A summerweight duvet (~5 tog)
    }
];

Comfort.comfort_classifications = [
    {
        description:    "Very Cold",
        color:          "#F00",
        gte_zero_pmv:   false,
        min_ppd:        75.0,
        max_ppd:        100.0
    },
    {
        description:    "Fairly Cold",
        color:          "#F50",
        gte_zero_pmv:   false,
        min_ppd:        50.0,
        max_ppd:        75.0,
    },
    {
        description:    "Uncomfortably Cold",
        color:          "#F90",
        gte_zero_pmv:   false,
        min_ppd:        25.0,
        max_ppd:        50.0
    },
    {
        description:    "Satisfactory (Cold)",
        color:          "#990",
        gte_zero_pmv:   false,
        min_ppd:        10.0,
        max_ppd:        25.0
    },
    {
        description:    "Ideal",
        color:          "#0F0",
        gte_zero_pmv:   true,
        min_ppd:        0.0,
        max_ppd:        10.0
    },
    // Neutral point: UP=COLD, DOWN=HOT
    {
        description:    "Ideal",
        color:          "#0F0",
        gte_zero_pmv:   true,
        min_ppd:        0.0,
        max_ppd:        10.0
    },
    {
        description:    "Satisfactory (Warm)",
        color:          "#5F0",
        gte_zero_pmv:   true,
        min_ppd:        10.0,
        max_ppd:        25.0
    },
    {
        description:    "Uncomfortably Hot",
        color:          "#F90",
        gte_zero_pmv:   true,
        min_ppd:        25.0,
        max_ppd:        50.0
    },
    {
        description:    "Very Hot",
        color:          "#F00",
        gte_zero_pmv:   true,
        min_ppd:        75.0,
        max_ppd:        100.0
    }
];