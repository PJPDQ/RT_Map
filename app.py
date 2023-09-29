import os
import sys
import uuid
from typing import Dict, Generator
from queue import Queue
from threading import Thread
import pandas as pd
from flask import Flask, Response, request, render_template
from consumer_broker import MessageBroker
from datetime import datetime
import json
from shapefetcher import traj_shp, stop_shp, hfs_stop_shp, static_mapper, high_frequency_buses

app = Flask(__name__)
broker = MessageBroker()
conns: Dict[uuid.UUID, Queue] = {}
hfs: Dict[str, Queue] = {}
# hfs_storage = pd.DataFrame()

def consume() -> None:
    for eid, content in broker.subscribe():
        for q in conns.values():
            q.put((eid, content))

def event_stream(user_id: uuid.UUID) -> Generator[str, None, None]:
    q = Queue()
    conns[user_id] = q
    try:
        while True:
            eid, content = q.get()
            data = pd.read_json(content)
            data = data.sort_values(by=["timestamp"])
            data['timestamp_dt'] = data['timestamp'].apply(lambda x: x.tz_localize(tz='utc').tz_convert('Australia/Brisbane'))
            data = data[['stop_id', 'timestamp', 'timestamp_dt','trip_id', 'latitude', 'longitude', 'route_id', 'id']]
            # hfs_data = data.loc[data['route_id'].apply(lambda x: x.split("-")[0]).isin(high_frequency_buses)]
            # hfs_data['bus_num'] = hfs_data['route_id'].apply(lambda x: x.split("-")[0])
            # hfs_storage = pd.concat([hfs_storage, hfs_data], ignore_index)
            # hfs_data_group = hfs_data.group
            for i in range(len(data)):
                msg = data.iloc[i].to_json()
                msg.encode('ascii')
                yield 'data:{0}\n\n'.format(msg)
            # print(hfs_data.head(3))
            
            # yield f"id:{eid}\ndata: {content}\n\n"
    finally:
        conns.pop(user_id)

def filter_trajectory(selected_routes, new_traj, hfs_stop_shp):
    """
    This function would filter the shapefile trajectory based on user prompt
    """
    filtered_routes = new_traj.Associate.str.split(" | ").map(lambda x: bool(set(selected_routes) & set(x)))
    new_traj = new_traj[filtered_routes]
    traj_msg = new_traj.to_json()
    new_stop = hfs_stop_shp[hfs_stop_shp['Route id'].isin(selected_routes)]
    stop_msg = new_stop.to_json()
    return traj_msg, stop_msg

@app.route("/gtfs_data")
def events() -> Response:
    user_id = uuid.uuid4()
    return Response(event_stream(user_id), mimetype="text/event-stream")

@app.route("/", methods=["GET", "POST"])
def viewer() -> str:
    new_traj = traj_shp.set_crs("EPSG:4326")
    if request.method == 'POST':
        # print(request.get_json())
        user_in_json = request.get_json()
        if 'markers' in user_in_json:
            # print(user_in_json)
            # data = pd.read_json()
            res = static_mapper(user_in_json['markers'])
            # print(res)
            return res
        else:
            # print(f"before filtering = {new_traj.shape}")
            selected_routes = request.get_json()['routes']
            # data = request.get_json()['data']
            # print(f"selected routes = {selected_routes}")
            traj_msg, stop_msg = filter_trajectory(selected_routes, new_traj, hfs_stop_shp)
            response = {
                'traj_shp': traj_msg,
                'stop_shp': stop_msg
            }
            return response
    traj_msg = new_traj.to_json()
    stop_msg = hfs_stop_shp.to_json()
    response = {
        "traj_shp": traj_msg,
        "stop_shp": stop_msg
    }
    # with open('result.json', 'w') as f:
    #     f.truncate()
    #     json.dump(response, f)
    return render_template("map.html", res_data=response)

if __name__ == "__main__":
    try:
        print("Starting consumer...")
        consumer_thread = Thread(target=consume, name="RabbitMQ Consumer")
        consumer_thread.daemon = True
        consumer_thread.start()

        print("Starting server...")
        app.run(port=5001, debug=True, use_reloader=False)
    except KeyboardInterrupt:
        consumer_thread.join()
        try:
            sys.exit(0)
        except SystemExit:
            os._exit(0)