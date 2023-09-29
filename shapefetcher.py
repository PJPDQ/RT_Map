import geopandas as gpd
import pandas as pd
import datetime
import time
from shapely.ops import nearest_points, linemerge
from shapely.geometry import Point, LineString
from ast import literal_eval
def Brisbane(epoch):
    a = time.strftime("%d-%m-%Y %H:%M:%S", time.localtime(epoch))
    return(a)

def monthname(mydate):
    ##Generate the today's month name instead of the selected date
    #mydate = datetime.datetime.now()
    m = mydate.strftime("%B")
    return(m)
    
def remove_unnamed(df):
    list_unnameds = [s for s in df.columns if 'Unnamed:' in s]
    if len(list_unnameds) > 0:
        df.drop(list_unnameds, axis=1, inplace=False)
    return df

def convert_to_float(x):
    return float(x[0]), float(x[1])

# def point_feature(data, geo):
#     return {
#         'type': 'Feature', 
#         'properties': {
#             "stop_id": "{}".format(data['stop_id']),
#             "reference_timestamp": "{}".format(data['timestamp']),
#             "inter_timestamp": "{}".format(data['timestamp']+1),
#             "inter_timestamp": "{}".format((data['timestamp']+1)), ####dt version of interpolated timestamp
#             "trip_id": "{}".format(data['trip_id']),
#             "latitude": "{}".format(data['latitude']),
#             "longitude": "{}".format(data['longitude']),
#             "r_latitude": "{}".format(data['r_latitude']),
#             "r_longitude": "{}".format(data['r_longitude']),
#             "route_id": "{}".format(data['route_id']),
#             "travel_time": "{}".format(data['travel_time']),
#             "id": "{}".format(data['id']),
#             "r_distance": "{}".format(data['distance']),
#             "i_distance": "{}".format(data['i_distance']),
#             "speed_sms": "{}".format(data['speed_sms'])
#         },
#         'geometry': {
#             "type": "Point",
#             "coordinates" : (geo['lon'], geo['lat'])
#         } 
#     }

def coords_gen(x, actual_line):
    # print(f"speeds = {x['speeds']} km/h")
    print(f"end distance = {x['distance_from_line']} km")
    print(f"start distance = {x['distance_travelled_from']} km")
    duration = int(x['travel_time_sec']) #sec
    print(f"duration = {duration}")
    speed = x['speed_sms'] #back to metre
    end_dist = x['distance_from_line']
    start_dist = x['distance_travelled_from']
    res = [x['nearest_pt']]
    res_time = [0]
    # print(f"end distance = {end_dist} km")
    # while abs(temp_dist - end_dist) > 1e-8:
    for i in range(1, duration):
        res_time.append(i)
        temp_dist = start_dist - ((speed * (i/3600))/100) if start_dist > end_dist else start_dist + ((speed * (i/3600))/100) #hour
        print(f"moving distance = {temp_dist} km")
        print(actual_line.interpolate(temp_dist))
        res.append(actual_line.interpolate(temp_dist))
        # if start_dist > end_dist:
        #     temp_dist -= ((speed*(i/3600))/100)
        # else:
        #     temp_dist += ((speed * (i/3600))/100) #hour
        # print(f"next moving distance = {temp_dist} km")
    # print(res)
    return res, res_time

def point_geojson_generator(data, line):
    """
    This function would generate a geojson that helps to generate point shapes
    """
    print(f"data = {data}")
    print(f"line = {line.length * 100}") ## to km
    # data = data.sort_values(by=['distance_from_line'])
    ##############################for loop line in multiline, identify the point max: cut the line adding all the rest of the lines and for min: cut the line, get the rest of the line too
    # print(f"max = {(data['distance_from_line'].idxmax() / 100)}")
    # print(f"min = {(data['distance_from_line'].idxmin() / 100)}")
    # print(line.length)
    # excess_line = cut(line, (data['distance_from_line'].idxmax() / 100))
    # print(excess_line)
    # print(excess_line[0].length)
    # actual_line = cut(excess_line[0], (data['distance_from_line'].idxmin() / 100))
    # print(actual_line)
    # print(actual_line[0].length)
    # print(f"actual_line = {actual_line.length*100}")
    # # data['pts'] = data[['travel_time_sec', 'speed']].apply(point_gen, act_line=actual_line)
    # res = {}
    # for idx, row in data[1:].iterrows():
    #     temp = []
    #     for i in range(1, row['travel_time_sec']+1):
    #         dist = (row['speed'] * (i/3600)) / 100
    #         pt = actual_line.interpolate(dist)
    #         temp.append(pt)
    #     actual_line = cut(actual_line, dist)[1]
    #     res[idx] = temp
    # data['pts'] = data.index.map(res)
    data['distance_travelled_from'] = data['distance_from_line'].shift(1)
    data = data.fillna(0)
    data['coords'], data['diff_time'] = zip(*data[['nearest_pt', 'speed_sms', 'distance_from_line', 'distance_travelled_from', 'travel_time_sec']].apply(coords_gen, actual_line = line, axis=1))
    new_data = data.explode(['coords', 'diff_time'])
    print(f"new_Data after explosion = {new_data}")
    # new_data['actual_timestamp'] = new_data[['timestamp', 'diff_time']].apply(lambda x: datetime.datetime.fromtimestamp(round(x.timestamp/1000)).tz_localize(tz='utc').tz_convert('Australia/Brisbane') + datetime.timedelta(x.diff_time), axis=1)
    new_data['actual_timestamp'] = new_data[['datetime', 'diff_time']].apply(lambda x: x.datetime + datetime.timedelta(seconds=x.diff_time), axis=1)
    
    new_data['actual_timestamp'] = new_data['actual_timestamp'].astype(str)
    print(new_data.info())
    new_data.to_csv("new_data_exploded.csv")
    new_data = new_data[['stop_id', 'actual_timestamp', 'trip_id', 'route_id', 'id', 'latitude', 'longitude', 'speed_sms', 'distance_from_line', 'distance_travelled_km', 'travel_time_sec', 'diff_time', 'coords']]
    print(new_data.columns)
    new_data_geo = gpd.GeoDataFrame(new_data, crs="EPSG:4376", geometry=new_data['coords'])
    res = new_data_geo[['stop_id', 'actual_timestamp', 'trip_id', 'route_id', 'id', 'latitude', 'longitude', 'speed_sms', 'distance_travelled_km', 'travel_time_sec', 'diff_time', 'geometry']]
    res.to_file("test_new_geo")
    new_data.to_csv("processed_data.csv")
    res_msg = res.to_json()
    # print(res.to_json())
    return res_msg

def static_mapper(user_input):
    """
    A function which map the datapoints into the route linestring to interpolate the vehicle trajectory from current to two prior epochs
    params:
        data: selected vehicles to display (a list of markers containing two prior, one prior and current)
        route_shape: the linestring shapefile of the data
    return:
        result: a geojson containing a linestring of an linearly interpolated 1-sec interval from current to two prior
    """
    print(f"static mapper starting... {user_input}")
    data = pd.DataFrame.from_records(user_input)
    print(data.info())
    print(data)
    data['stop_id'] = data['stop_id'].astype(int)
    data = data.sort_values(by=["timestamp"])
    data['datetime'] = data['timestamp'].apply(lambda x: datetime.datetime.fromtimestamp(round(x/1000)))
    cols = data.columns
    data['travel_time'] = data['datetime'].diff()
    data['travel_time_sec'] = data['travel_time'].apply(lambda x: x.total_seconds())
    cols = [*cols, 'travel_time_sec']
    data = data[cols]
    data['travel_time_hour'] = (data['travel_time_sec'] / 3600) ## sec to hour
    print("traveltime computed!")
    print(data)
    ## data = pd.DataFrame or pd.fromjson????
    ##### by this stage the three markers are pandas dataframe with trip_id, stop_id, lat_lon, route_id etc.
    data_route_static = routes_table[(routes_table['trip_id'] == data['trip_id'].unique()[0]) & (routes_table['stop_id'].isin(data['stop_id'].unique()))] ## TEST2
    print(f"data_route = {data_route_static}")
    data_shape = shapes_table[(shapes_table['shape_id'] == data_route_static['shape_id'].unique()[0]) & (shapes_table['stop_seq_1'].isin(data_route_static['stop_sequence'].tolist()))] ##SHAPES4 TEST3
    print(f"data_shape = {data_shape}")
    print(f"data_shape distance = {data_shape['distance']}")
    res = {'type': 'FeatureCollection', 'crs': {"type": "name", "properties": {"name": "EPSG:4326"}}, 'features': []}
    if len(data_shape) < 3:
        lists_list = data_shape.groupby(['shape_id'])['names_list'].apply(" | ".join).str.rsplit(" | ").to_list()
        print(f"lists of links = {lists_list}")
        link_list = lists_list[0]
        selected_shape = traj_shp[(traj_shp['Name'].isin(link_list)) & (traj_shp['direction_'] == data_route_static.direction_id.unique()[0])] ##GDF
        line_selected_shape = linemerge((line for line in selected_shape.geometry))
        # line_selected_shape = LineString(data_shape['routes_list'].sum())
        data['nearest_pt'] = data[['latitude', 'longitude']].apply(lambda x: nearest_points(line_selected_shape, Point((x['longitude'], x['latitude'])))[0], axis=1)
        data['distance_from_line'] = data['nearest_pt'].apply(lambda x: line_selected_shape.project(x)) #km
        print(f"distance computed = {data}")
        ####NEEDS TO DOUBLE CHECK!!!DISTANCE CALCULATION!!!######
        # data = data.sort_values(by=['distance_from_line'])
        data['actual_distance_km'] = data['distance_from_line'].apply(lambda x: x*100) ## to km
        data['distance_travelled_km'] = abs(data['actual_distance_km'].diff())
        data['speed_sms'] = data['distance_travelled_km'] / (data['travel_time_hour']) ## km/h
        data = data.fillna(0)
        data2 = data[['stop_id', 'datetime', 'trip_id', 'route_id', 'id', 'latitude', 'longitude', 'nearest_pt', 'distance_travelled_km', 'distance_from_line', 'speed_sms', 'travel_time_sec']]
        pt_gjson = point_geojson_generator(data2, line_selected_shape)
        res['features'] = pt_gjson
    else:
        res['features'] = []
    return res

WORKING_DIR = "Y:\\Sentosa\\"
shapefile_dir = f"{WORKING_DIR}FINAL_STATIC_GDF_26-8-2021\\"
traj_shp = gpd.read_file(shapefile_dir + "FINAL_STATIC_GDF_26-8-2021.shp")
traj_shp = traj_shp.set_crs("EPSG:4326")
stop_dir = f"{WORKING_DIR}stop_gdf\\"
stop_shp = gpd.read_file(stop_dir+"stop_gdf.shp")
stop_shp = stop_shp.set_crs("EPSG:4326")
hfs_stop_shp = gpd.read_file(shapefile_dir + "Stops.shp")
hfs_stop_shp = hfs_stop_shp.set_crs("EPSG:4326")
hfs_stop_shp['Route id'] = hfs_stop_shp['Route id'].astype(str)

t = int(time.time())
datee = datetime.datetime.strptime(str(Brisbane(t)),"%d-%m-%Y %H:%M:%S" )
m = datee.month
y = datee.year
d = datee.day
date_name = str(d)+"-"+str(m)+"-"+str(y)
m_name = monthname(datee)
Month_year = str(m_name)+" ,"+str(y)
daily_static_dir = f"{WORKING_DIR}\\1Dec22\\Static_Preprocessing\\"
HFS_dir = f"{daily_static_dir}HFS\\"
shapes_dir = f"{daily_static_dir}shapes4\\"

fetched_shapes_table = pd.read_csv(f"{shapes_dir}\\{Month_year}\\shapes4_combine_{date_name}.csv")
routes_stop_table = pd.read_csv(f"{HFS_dir}\\{Month_year}\\HFS_Route_Shape_stop_{date_name}.csv")
shapes_table = remove_unnamed(fetched_shapes_table)
shapes_table['routes_list'] = shapes_table['routes_list'].apply(lambda x: tuple(map(convert_to_float, literal_eval(x))))
routes_table = remove_unnamed(routes_stop_table)
routes_table['shape_id'] = routes_table['shape_id'].astype(str)
high_frequency_buses = ['60', '61', '100', '111' ,'120', '130' ,'140', '150', '180', '196' , '199' ,'200' ,'222', '330', '333' ,'340', '345', '385', '412', '444', '555']
# shapes_table['routes_list'] = shapes_table['routes_list'].apply(lambda x: literal_eval(x))
# shapes_table = pd.read_csv(f"{daily_static_dir}shapes4_combine_8-8-2023.csv")
# routes_stop_table = pd.read_csv(f"{daily_static_dir}HFS_Route_Shape_stop_8-8-2023.csv")
# new_traj_shp = gpd.read_file(daily_static_dir + f"STATIC_GDF_{date_name}.shp")
# new_traj_shp = traj_shp.set_crs("EPSG:4326")
