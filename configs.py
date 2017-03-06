import os

CLOUD_STORAGE_BUCKET = os.environ.get('CLOUD_STORAGE_BUCKET', 'khet-online-storage')
PROJECT_NAME = os.environ.get('PROJECT_NAME', 'khet-online-prod')
LOCAL = os.environ.get('LOCAL', None)
if LOCAL is None:
    os.environ['DATASTORE_DATASET'] ='khet-online-prod'
    os.environ['DATASTORE_EMULATOR_HOST'] = 'localhost:8032'
    os.environ['DATASTORE_EMULATOR_HOST_PATH'] = 'localhost:8032/datastore'
    os.environ['DATASTORE_HOST'] = 'http://localhost:8032'
    os.environ['DATASTORE_PROJECT_ID'] = 'khet-online-prod'
