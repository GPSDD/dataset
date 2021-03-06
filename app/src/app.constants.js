const USER_ROLES = ['USER', 'MANAGER', 'ADMIN', 'SUPERADMIN'];
const STATUS = ['pending', 'saved', 'failed'];
const INCLUDES = ['vocabulary', 'metadata', 'user'];
const CONNECTOR_TYPES = {
    rest: {
        provider: ['cartodb', 'featureservice', 'gee', 'bigquery', 'rasdaman', 'nexgddp', 'worldbank', 'resourcewatch', 'hdx', 'genericindex', 'un']
    },
    document: {
        provider: ['csv', 'json', 'tsv', 'xml']
    },
    wms: {
        provider: ['wms']
    }
};
const RASDAMAN_TYPES = ['tif', 'tiff', 'geo.tiff'];

module.exports = {
    USER_ROLES,
    STATUS,
    INCLUDES,
    CONNECTOR_TYPES,
    RASDAMAN_TYPES,
};
