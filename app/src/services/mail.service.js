const SparkPost = require('sparkpost');
const Promise = require('bluebird');
const logger = require('logger');
const config = require('config');

class MailService {
  constructor() {
    this.client = new SparkPost(process.env.SPARKPOST_API_KEY);
  }

  async sendDatasetMail(data, recipients) {
      logger.debug('Sending dataset created to ', recipients);
      logger.debug('sparkpostKey ', process.env.SPARKPOST_API_KEY);
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
          this.client.transmissions.send(reqOpts, (error, res) => {
              if (error) {
                  reject(error);
              } else {
                  resolve(res);
              }
          });
      });
  }
}
module.exports = new MailService();
