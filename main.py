import os

from flask import request
from flask import send_from_directory

import api.settings
from flask import Flask, Blueprint
from api.api import rest_api

# Google App Engine will look for this variable
app = Flask(__name__)

file_blueprint = Blueprint('static_files', __name__, url_prefix='/site')


@file_blueprint.route('/<path:path>')
def files(path):
    return send_from_directory('static', path)


@app.route('/')
def empty_route():  # Set default route
    return send_from_directory('static', "index.html")


def configure_app(flask_app):
    # flask_app.config['SERVER_NAME'] = api.settings.FLASK_SERVER_NAME
    flask_app.config['SWAGGER_UI_DOC_EXPANSION'] = api.settings.RESTPLUS_SWAGGER_UI_DOC_EXPANSION
    flask_app.config['RESTPLUS_VALIDATE'] = api.settings.RESTPLUS_VALIDATE
    flask_app.config['RESTPLUS_MASK_SWAGGER'] = api.settings.RESTPLUS_MASK_SWAGGER
    flask_app.config['ERROR_404_HELP'] = api.settings.RESTPLUS_ERROR_404_HELP


configure_app(app)
blueprint = Blueprint('api', __name__, url_prefix='/api')
rest_api.init_app(blueprint)
app.register_blueprint(file_blueprint)
app.register_blueprint(blueprint)


@app.before_request
def before_request():
    """This is a workaround to the bug described at
  https://github.com/noirbizarre/flask-restplus/issues/84"""
    try:
        ctlen = int(request.headers.environ.get('CONTENT_LENGTH', 0))
        if ctlen == 0:
            request.headers.environ['CONTENT_TYPE'] = None
    except:
        pass


if __name__ == "__main__":
    app.run(debug=api.settings.FLASK_DEBUG, port=80, threaded=True)
