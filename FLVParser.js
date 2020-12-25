(function() {

    DataView.prototype.getInt24 = function(offset) {
        return (this.getInt32(offset) & 0xffffff00) >> 8;
    }

    class FLVParser {
    
        constructor(buf) {
            this.buf = buf;
            this.header = {};
            this.body = {};
        }
    
        parse() {
            const header = this._parseHeader();

            const body = this._parseBody();

            return {
                header,
            };
        }
    
        _parseHeader() {
            const headerDataView = new DataView(this.buf);

            if (headerDataView.byteLength < 9) {
                throw new Error('非法文件');
            }
            
            const sign1 = headerDataView.getInt8(0);
            const sign2 = headerDataView.getInt8(1);
            const sign3 = headerDataView.getInt8(2);

            if (sign1 !== 0x46 || sign2 !== 0x4c || sign3 !== 0x56) {
                throw new Error('文件类型错误');
            }

            const headerInfo = {
                fileType: 'flv',
                version: -1,
                audio: false,
                video: false,
                headerSize: -1,
            };

            // version 1 字节
            headerInfo.version = headerDataView.getInt8(3);

            /**
             * flags 1 字节 
             * 前5位保留 
             * 第6位表示是否有音频Tag 
             * 第7位保留 
             * 第8位表示是否有视频Tag
             */
            const flags = headerDataView.getInt8(4);
            headerInfo.audio = (flags & 0b00000100) === 4;
            headerInfo.video = (flags & 0b00000001) === 1;

            headerInfo.headerSize = headerDataView.getInt32(5);

            return headerInfo;
        }

        _parseBody() {
            const bodyDataView = new DataView(this.buf);
            let offset = 9; // 理解为arrayBuffer的地址

            // prevTagSize 4 字节
            const prevTagSize = bodyDataView.getInt32(offset);
            offset += 4;

            // 以下是 Tag Header
            /**
             * Type 1 字节 表示Tag的类型
             * 0x08 音频Tag
             * 0x09 视频Tag
             * 0x12 Script Tag
             */
            const tagType = bodyDataView.getInt8(offset);
            offset += 1;

            // data size 3 字节 表示该 Tag Data的大小
            const dataSize = bodyDataView.getInt24(offset);
            offset += 3;

            // timestamp 3 字节 表示 Tag的时间戳
            // timestamp 的扩展 1 字节 表示 Tag的时间戳24位不够用的，扩展成32位
            const ts1 = bodyDataView.getInt8(offset + 3);
            const ts2 = bodyDataView.getInt8(offset);
            const ts3 = bodyDataView.getInt8(offset + 1);
            const ts4 = bodyDataView.getInt8(offset + 2);
            const ts = ts1 << 24 | ts2 << 16 | ts3 << 8 | ts4;
            offset += 4;

            // streamID 3 字节 表示 stream id总是0
            const streamID = bodyDataView.getInt24(offset);
            offset += 3;

            console.table({
                prevTagSize,
                tagType,
                dataSize,
                timestamp: ts,
                streamID,
            });

            // 获取 Tag Data
            if (tagType === 18) {
                this._parseScriptTag(offset);
            } else if (tagType === 8) {
                this._parseAudioTag(offset);
            } else if (tagType === 9) {
                this._parseVideoTag(offset);
            }

            // offset += dataSize;

        }

        /**
         * script tag又称metadata tag 会放一些音视频的无数据 duration width height
         * 一般会紧跟着flv header出现，而且只有一个
         */
        _parseScriptTag(offset) {
            const metadataTagBodyView = new DataView(this.buf);
            
            // AMF1 
            // FLV文件中，第一个字节一般总是0x02，表示字符串。第2-3个字节为UI16类型值，
            // 标识字符串的长度，一般总是0x000A（“onMetaData”长度）。后面字节为具体的字符串，
            // 一般总为“onMetaData”（6F,6E,4D,65,74,61,44,61,74,61）。
            const amf1 = [0x02, 0x00, 0x0a, 0x6F, 0x6E, 0x4D, 0x65, 0x74, 0x61, 0x44, 0x61, 0x74, 0x61];
            for (let i = 0; i < amf1.length; i++) {
                const d = metadataTagBodyView.getInt8(offset + i);
                if (d !== amf1[i]) {
                    // AMF1 不为 "onMetaData"
                    console.warn('warn: Script Tag的AMF1内容不为 "onMetaData"');
                    break;
                }
            }

            offset += amf1.length;
           
            // AMF2
            
        }

        _parseAudioTag(offset) {}

        _parseVideoTag(offset) {}
    }

    window.FLVParser = FLVParser;
})();

