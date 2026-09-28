import * as path from 'path';
import { createLogger, format, transports } from 'winston';
const { combine, timestamp, label, printf } = format;

// tslint:disable-next-line:only-arrow-functions
const getLabel = function(moduleName: { filename: string }) {
    const parts = moduleName.filename.split(path.sep);
    return path.join(parts[parts.length - 2], parts.pop() || '');
};

// tslint:disable-next-line:no-shadowed-variable
const myFormat = printf(({ level, message, label, timestamp }) => {
    return `${timestamp} [${level}] [${label}]: ${message}`;
});

export default function (moduleName: { filename: string }) {
    return createLogger({
        format: combine(
            label({ label: getLabel(moduleName) }),
            timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
            myFormat
        ),
        transports: [new transports.Console()]
    });
}