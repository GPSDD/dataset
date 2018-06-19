const logger = require('logger');
const DatasetNotValid = require('errors/datasetNotValid.error');
const CONNECTOR_TYPES = require('app.constants').CONNECTOR_TYPES;
const RASDAMAN_TYPES = require('app.constants').RASDAMAN_TYPES;
const URL = require('url').URL;
const cronParser = require('cron-parser');


class DatasetValidator {

    static getUser(ctx) {
        return Object.assign({}, ctx.request.query.loggedUser ? JSON.parse(ctx.request.query.loggedUser) : {}, ctx.request.body.loggedUser);
    }

    static isString(property) {
        return (typeof property === 'string' && property.length >= 0);
    }

    static notEmptyString(property) {
        return (typeof property === 'string' && property.length > 0);
    }

    static validUrl(property) {
        try {
            if (typeof property === 'string' && new URL(property)) {
                return true;
            }
        } catch (err) {
            return false;
        }
        return false;
    }

    static isArray(property) {
        return (property instanceof Array);
    }

    static notEmptyArray(property) {
        return (property instanceof Array && property.length > 0);
    }

    static isObject(property) {
        return (property instanceof Object && property.length === undefined);
    }

    static checkConnectorType(connectorType) {
        return (Object.keys(CONNECTOR_TYPES).indexOf(connectorType) >= 0);
    }

    static checkProvider(provider, koaObj = {}) {
        return (
            Object.keys(CONNECTOR_TYPES).indexOf(koaObj.request.body.connectorType) >= 0 &&
            CONNECTOR_TYPES[koaObj.request.body.connectorType].provider.indexOf(provider) >= 0
        );
    }

    static checkConnectorUrl(connectorUrl, koaObj) {
        let validation = false;
        const connectorType = koaObj.request.body.connectorType;
        const provider = koaObj.request.body.provider;
        const data = koaObj.request.body.data;
        const tableName = koaObj.request.body.tableName;

        const connectorWithTableName = ['gee', 'bigquery', 'nexgddp', 'worldbank', 'resourcewatch'];

        if (provider === 'genericindex') return true;

        // it is a document - json?
        if (connectorType === 'document' && provider === 'json') {
            // is it data valid?
            if (DatasetValidator.isArray(data) || DatasetValidator.isObject(data)) {
                validation = true;
                // if data is not provided, check if url is valid
            } else {
                validation = (DatasetValidator.validUrl(connectorUrl) || connectorUrl.indexOf('rw.dataset.raw') >= 0);
            }
            // is it a gee or bigquery dataset?
        } else if (connectorType === 'rest' && connectorWithTableName.includes(provider)) {
            // is it tableName valid?
            validation = (DatasetValidator.notEmptyString(tableName));
            // in other cases just validate url
        } else if (connectorUrl && (DatasetValidator.validUrl(connectorUrl) || connectorUrl.indexOf('rw.dataset.raw') >= 0)) {
            validation = true;
        }

        return validation;
    }

    static checkSync(sync) {
        if (DatasetValidator.isObject(sync)) {
            try {
                cronParser.parseExpression(sync.cronPattern);
                return (['concat', 'overwrite'].indexOf(sync.action) >= 0 && DatasetValidator.validUrl(sync.url));
            } catch (err) {
                return false;
            }
        }
        return false;
    }

    static errorMessage(property, koaObj = {}) {
        let errorMessage = 'validation error';

        switch (property) {

        case 'connectorType':
            errorMessage = `must be valid [${Object.keys(CONNECTOR_TYPES).reduce((acc, el) => `${acc}, ${el}`)}]`;
            break;
        case 'provider':
            if (CONNECTOR_TYPES[koaObj.request.body.connectorType]) {
                errorMessage = `must be valid [${CONNECTOR_TYPES[koaObj.request.body.connectorType].provider.reduce((acc, el) => `${acc}, ${el}`)}]`;
            } else {
                errorMessage = `there is no provider for that connectorType`;
            }
            break;
        case 'connectorUrl':
            errorMessage = `empty or invalid connectorUrl`;
            break;
        default:
            // do nothing

        }
        return errorMessage;
    }

    static async validateCreation(koaObj) {
        logger.info('Validating Dataset Creation');
        koaObj.checkBody('name').notEmpty().check(name => DatasetValidator.notEmptyString(name), 'can not be empty');
        koaObj.checkBody('type').optional().check(type => DatasetValidator.isString(type), 'must be a string');
        koaObj.checkBody('dataPath').optional().check(dataPath => DatasetValidator.isString(dataPath), 'must be a string');
        koaObj.checkBody('attributesPath').optional().check(attributesPath => DatasetValidator.isString(attributesPath), 'must be a string');
        // connectorType
        koaObj.checkBody('connectorType').notEmpty()
            .toLow()
            .check(connectorType => DatasetValidator.checkConnectorType(connectorType), DatasetValidator.errorMessage('connectorType'));
        // provider
        koaObj.checkBody('provider').notEmpty()
            .toLow()
            .check(provider => DatasetValidator.checkProvider(provider, koaObj), DatasetValidator.errorMessage('provider', koaObj));
        // connectorUrl
        koaObj.checkBody('connectorUrl').check(connectorUrl => DatasetValidator.checkConnectorUrl(connectorUrl, koaObj), DatasetValidator.errorMessage('connectorUrl'));
        koaObj.checkBody('tableName').optional().check(tableName => DatasetValidator.isString(tableName), 'must be a string');
        koaObj.checkBody('published').optional().toBoolean();
        koaObj.checkBody('sandbox').optional().toBoolean();
        koaObj.checkBody('overwrite').optional().toBoolean();
        koaObj.checkBody('verified').optional().toBoolean();
        koaObj.checkBody('dataOverwrite').optional().toBoolean();
        koaObj.checkBody('data').optional().check(data => (DatasetValidator.isArray(data) || DatasetValidator.isObject(data)),
            'must be a valid JSON'
        );
        koaObj.checkBody('subscribable').optional().check(subscribable => DatasetValidator.isObject(subscribable), 'must be an object');
        koaObj.checkBody('legend').optional().check(legend => DatasetValidator.isObject(legend), 'must be an object');
        koaObj.checkBody('vocabularies').optional().check(vocabularies => DatasetValidator.isObject(vocabularies), 'must be an object');
        koaObj.checkBody('sync').optional().check(sync => DatasetValidator.checkSync(sync), 'not valid');
        if (koaObj.errors) {
            logger.error('Error validating dataset creation');
            throw new DatasetNotValid(koaObj.errors);
        }
        return true;
    }

    static async validateUpdate(koaObj) {
        logger.info('Validating Dataset Update');
        koaObj.checkBody('name').optional().check(name => DatasetValidator.notEmptyString(name), 'can not be empty');
        koaObj.checkBody('type').optional().check(type => DatasetValidator.isString(type), 'must be a string');
        koaObj.checkBody('dataPath').optional().check(dataPath => DatasetValidator.isString(dataPath), 'must be a string');
        koaObj.checkBody('attributesPath').optional().check(attributesPath => DatasetValidator.isString(attributesPath), 'must be a string');
        koaObj.checkBody('connectorType').optional().check(connectorType => DatasetValidator.isString(connectorType), 'must be a string');
        koaObj.checkBody('provider').optional().check(provider => DatasetValidator.isString(provider), 'must be a string');
        koaObj.checkBody('connectorUrl').optional().check(connectorUrl => DatasetValidator.notEmptyString(connectorUrl), 'can not be empty');
        koaObj.checkBody('tableName').optional().check(tableName => DatasetValidator.isString(tableName), 'must be a string');
        koaObj.checkBody('published').optional().toBoolean();
        koaObj.checkBody('sandbox').optional().toBoolean();
        koaObj.checkBody('overwrite').optional().toBoolean();
        koaObj.checkBody('verified').optional().toBoolean();
        koaObj.checkBody('dataOverwrite').optional().toBoolean();
        koaObj.checkBody('errorMessage').optional().check(errorMessage => DatasetValidator.isString(errorMessage), 'must be a string');
        koaObj.checkBody('taskId').optional().check(taskId => DatasetValidator.isString(taskId), 'must be a string');
        koaObj.checkBody('data').optional().check(data => (DatasetValidator.isArray(data) || DatasetValidator.isObject(data))
            , 'must be a valid JSON');
        koaObj.checkBody('subscribable').optional().check(subscribable => DatasetValidator.isObject(subscribable), 'must be an object');
        koaObj.checkBody('legend').optional().check(legend => DatasetValidator.isObject(legend));
        koaObj.checkBody('blockchain').optional().check(blockchain => DatasetValidator.isObject(blockchain));
        koaObj.checkBody('vocabularies').optional().check(vocabularies => DatasetValidator.isObject(vocabularies));
        koaObj.checkBody('sync').optional().check(sync => DatasetValidator.checkSync(sync), 'not valid');
        if (koaObj.errors) {
            logger.error('Error validating dataset creation');
            throw new DatasetNotValid(koaObj.errors);
        }
        return true;
    }

    static async validateCloning(koaObj) {
        logger.info('Validating Dataset Cloning');
        koaObj.checkBody('datasetUrl').notEmpty().isAscii();
        if (koaObj.errors) {
            logger.error('Error validating dataset creation');
            throw new DatasetNotValid(koaObj.errors);
        }
        return true;
    }

    static async validateUpload(koaObj) {
        logger.info('Validating Dataset Raw Upload');
        koaObj.checkFile('dataset').notEmpty();
        koaObj.checkBody('provider').in(CONNECTOR_TYPES.document.provider.concat(RASDAMAN_TYPES));
        if (koaObj.request.body.fields.loggedUser) {
            const loggedUser = JSON.parse(koaObj.request.body.fields.loggedUser);
            if (loggedUser.role === 'USER') {
                koaObj.checkFile('dataset').size(0, 4 * 1024 * 1024, 'file too large');
            }
        }
        if (koaObj.request.body.files) {
            koaObj.checkFile('dataset').suffixIn(koaObj.request.body.fields.provider);
        }
        if (koaObj.errors) {
            logger.error('Errors uploading', koaObj.errors);
            // koaObj.errors = [{
            //     dataset: 'it has to be a valid file'
            // }];
            logger.error('Error validating dataset creation');
            throw new DatasetNotValid(koaObj.errors);
        }
        return true;
    }

}

module.exports = DatasetValidator;
