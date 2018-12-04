const SparkPost = require('sparkpost');
const Promise = require('bluebird');
const logger = require('logger');

const sparkpostKey = process.env.SPARKPOST_API_KEY;
logger.debug('sparkpostKey ', sparkpostKey);
const Client = new SparkPost(sparkpostKey);

class MailService {

   static async sendDatasetMail(data, recipients) {
        logger.debug('Sending dataset created to ', recipients);
        const reqOpts = {
            transmissionBody: {
                substitution_data: {
                    name: `${data.name}`,
                    id: `${data.id}`,
                },
                content: {
                    template_id: 'dataset-created',
                },
                recipients,
            },
        };
        return new Promise((resolve, reject) => {
          logger.debug(reqOpts);
            Client.transmissions.send(reqOpts, (error, res) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(res);
                }
            });
        });
    }
}
module.exports = MailService;
