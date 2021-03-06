import datetime
import random
import string

import yara

from backend import db


class Webpage(db.Model):
    __tablename__ = 'webpage'
    id = db.Column(db.Text, primary_key=True)
    url = db.Column(db.Unicode(2048), unique=True)
    pageviews = db.relationship('Pageview', backref='webpage')
    tags = db.relationship('Tag', backref='webpage')


class Pageview(db.Model):
    __tablename__ = 'pageview'
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.Unicode(2048), db.ForeignKey('webpage.url'))
    date = db.Column(db.DateTime, unique=False)
    resources = db.relationship('Resource', backref='pageview')

    def __init__(self, **kwargs):
        super(Pageview, self).__init__(**kwargs)
        self.date = datetime.datetime.now()


class Resource(db.Model):
    __tablename__ = 'resource'
    id = db.Column(db.Integer, primary_key=True)
    pageview_id = db.Column(db.Integer, db.ForeignKey('pageview.id'))
    url = db.Column(db.Unicode(2048), unique=False)
    hash = db.Column(db.Text, unique=False)
    type = db.Column(db.Unicode(32), unique=False)


class Tag(db.Model):
    __tablename__ = 'tag'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Unicode(255), unique=True)
    url = db.Column(db.Unicode(2048), db.ForeignKey('webpage.url'))


class RoboTask(db.Model):
    __tablename__ = 'robotask'
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.Unicode(2048), unique=False)
    priority = db.Column(db.Integer, unique=False)


class Suggestions(db.Model):
    __tablename__ = 'suggestions'
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Unicode(4096), unique=False)


class Errors(db.Model):
    __tablename__ = 'errors'
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.DateTime, unique=False)
    content = db.Column(db.Unicode(4096), unique=False)


class YaraRuleset(db.Model):
    __tablename__ = 'yara_ruleset'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.Unicode(255))
    namespace = db.Column(db.Unicode(255))
    source = db.Column(db.Unicode(40960))
    scan_on_upload = db.Column(db.Boolean)
    removal_code = db.Column(db.Unicode(255))
    email_tokens = db.Column(db.Integer)
    last_received_tokens = db.Column(db.DateTime)

    def __init__(self, email, namespace, source, scan):
        self.email = email
        self.namespace = namespace
        self.source = source
        self.scan_on_upload = scan
        
        self.last_received_tokens = datetime.datetime.now()
        self.email_tokens = 5
        self.removal_code = ''.join(random.choice(string.ascii_letters) for _ in range(32))

        # we test out compiling the yara rule now so that an
        # invalid rule can not be instantiated, but instead 
        # will throw an exception.
        test_sources = {self.namespace: self.source}
        yara_rule = yara.compile(sources=test_sources)
   
