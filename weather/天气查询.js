//[public:true]
//[title:天气查询]
//[author:AI Assistant]
//[description:基于高德地图API的天气查询插件,支持全国所有城市区县的实时天气和天气预报查询]
//[rule:^(.+)天气$]
//[rule:^(.+)天气预报$]
//[rule:^天气帮助$]
//[admin:false]
//[priority:100]
//[disable:false]
//[version:1.2.0]
//[param: {"required":true,"key":"weather.amapApiKey","bool":false,"placeholder":"请输入高德地图API Key","name":"高德地图API Key","desc":"在 https://console.amap.com/dev/key/app 申请Web服务Key"}]

// 城市名称到adcode的映射表(常用城市)
var cityMap = {
    "北京": "110000",
    "上海": "310000",
    "天津": "120000",
    "重庆": "500000",
    "广州": "440100",
    "深圳": "440300",
    "成都": "510100",
    "杭州": "330100",
    "武汉": "420100",
    "西安": "610100",
    "郑州": "410100",
    "南京": "320100",
    "济南": "370100",
    "沈阳": "210100",
    "长春": "220100",
    "哈尔滨": "230100",
    "石家庄": "130100",
    "太原": "140100",
    "呼和浩特": "150100",
    "长沙": "430100",
    "福州": "350100",
    "南昌": "360100",
    "合肥": "340100",
    "昆明": "530100",
    "贵阳": "520100",
    "南宁": "450100",
    "兰州": "620100",
    "西宁": "630100",
    "银川": "640100",
    "乌鲁木齐": "650100",
    "拉萨": "540100",
    "海口": "460100",
    "三亚": "460200",
    "苏州": "320500",
    "无锡": "320200",
    "宁波": "330200",
    "青岛": "370200",
    "大连": "210200",
    "厦门": "350200",
    "东莞": "441900",
    "佛山": "440600",
    "珠海": "440400",
    "中山": "442000"
};

// 获取配置的API Key
var apiKey = bucketGet("weather", "amapApiKey");

// 主函数
function main() {
    var content = GetContent();

    // 处理帮助命令
    if (content === "天气帮助") {
        showHelp();
        return;
    }

    // 检查API Key是否配置
    if (!apiKey || apiKey === "") {
        sendText("❌ 未配置高德地图API Key\n\n请在插件参数中配置 AMAP_API_KEY\n发送「天气帮助」查看详细说明");
        return;
    }

    // 解析城市名和查询类型
    var isForecast = content.indexOf("天气预报") !== -1;
    var cityName = content.replace("天气预报", "").replace("天气", "").trim();

    if (!cityName) {
        sendText("❌ 请输入城市名称\n\n示例:\n• 北京天气\n• 上海天气预报\n• 朝阳区天气\n• 浦东新区天气预报\n\n发送「天气帮助」查看更多");
        return;
    }

    // 获取城市adcode(异步)
    getCityAdcode(cityName, function (adcode, error) {
        if (error) {
            sendText("❌ " + error);
            return;
        }

        if (!adcode) {
            showCityNotFound(cityName);
            return;
        }

        // 查询天气
        if (isForecast) {
            queryWeatherForecast(cityName, adcode);
        } else {
            queryWeatherNow(cityName, adcode);
        }
    });
}

// 获取城市adcode(同步方式,通过回调返回)
function getCityAdcode(cityName, callback) {
    // 先尝试从缓存映射表直接匹配
    if (cityMap[cityName]) {
        callback(cityMap[cityName]);
        return;
    }

    // 尝试模糊匹配(去掉"市"、"县"、"区"字)
    var simpleName = cityName.replace("市", "").replace("县", "").replace("区", "");
    if (cityMap[simpleName]) {
        callback(cityMap[simpleName]);
        return;
    }

    // 如果输入的是纯数字,当作adcode处理
    if (/^\d{6}$/.test(cityName)) {
        callback(cityName);
        return;
    }

    // 使用高德地理编码API查询
    var url = "https://restapi.amap.com/v3/geocode/geo?address=" + encodeURIComponent(cityName) + "&key=" + apiKey;

    request({
        url: url,
        method: "get",
        headers: {
            "User-Agent": "autMan Weather Plugin/1.2"
        },
        dataType: "json",
        timeOut: 10000
    }, function (error, response, header, body) {
        if (error) {
            callback(null, "网络请求失败: " + error);
            return;
        }

        var data = body;

        if (data.status !== "1") {
            callback(null, "地理编码查询失败: " + (data.info || "未知错误"));
            return;
        }

        if (!data.geocodes || data.geocodes.length === 0) {
            callback(null, "未找到城市「" + cityName + "」");
            return;
        }

        // 获取第一个匹配结果的adcode
        var adcode = data.geocodes[0].adcode;
        callback(adcode);
    });
}

// 显示城市未找到的智能提示
function showCityNotFound(cityName) {
    var message = "❌ 未找到城市「" + cityName + "」\n\n";
    message += "💡 提示:\n";
    message += "• 请检查城市名称是否正确\n";
    message += "• 支持省/市/区/县名称查询\n";
    message += "• 示例: 北京天气、朝阳区天气、浦东新区天气\n\n";
    message += "发送「天气帮助」查看使用说明";

    sendText(message);
}

// 查询实时天气
function queryWeatherNow(cityName, adcode) {
    var url = "https://restapi.amap.com/v3/weather/weatherInfo?city=" + adcode + "&key=" + apiKey + "&extensions=base";

    request({
        url: url,
        method: "get",
        headers: {
            "User-Agent": "autMan Weather Plugin/1.0"
        },
        dataType: "json",
        timeOut: 10000
    }, function (error, response, header, body) {
        if (error) {
            sendText("❌ 网络请求失败: " + error);
            return;
        }

        // dataType: "json" 时,body 已经是解析后的对象
        var data = body;

        if (data.status !== "1") {
            sendText("❌ 查询失败: " + (data.info || "未知错误"));
            return;
        }

        if (!data.lives || data.lives.length === 0) {
            sendText("❌ 未获取到天气数据");
            return;
        }

        var weather = data.lives[0];
        formatWeatherNow(cityName, weather);
    });
}

// 查询天气预报
function queryWeatherForecast(cityName, adcode) {
    var url = "https://restapi.amap.com/v3/weather/weatherInfo?city=" + adcode + "&key=" + apiKey + "&extensions=all";

    request({
        url: url,
        method: "get",
        headers: {
            "User-Agent": "autMan Weather Plugin/1.0"
        },
        dataType: "json",
        timeOut: 10000
    }, function (error, response, header, body) {
        if (error) {
            sendText("❌ 网络请求失败: " + error);
            return;
        }

        // dataType: "json" 时,body 已经是解析后的对象
        var data = body;

        if (data.status !== "1") {
            sendText("❌ 查询失败: " + (data.info || "未知错误"));
            return;
        }

        if (!data.forecasts || data.forecasts.length === 0) {
            sendText("❌ 未获取到预报数据");
            return;
        }

        var forecast = data.forecasts[0];
        formatWeatherForecast(cityName, forecast);
    });
}

// 格式化实时天气
function formatWeatherNow(cityName, weather) {
    var weatherIcon = getWeatherIcon(weather.weather);

    var message = "🌤 " + cityName + " 实时天气\n";
    message += "━━━━━━━━━━━━━━━\n";
    message += weatherIcon + " 天气: " + weather.weather + "\n";
    message += "🌡 温度: " + weather.temperature + "°C\n";
    message += "💧 湿度: " + weather.humidity + "%\n";
    message += "🍃 风向: " + weather.winddirection + "风\n";
    message += "💨 风力: " + weather.windpower + "级\n";
    message += "📅 更新: " + weather.reporttime + "\n";
    message += "━━━━━━━━━━━━━━━\n";
    message += "💡 发送「" + cityName + "天气预报」查看未来天气";

    sendText(message);
}

// 格式化天气预报
function formatWeatherForecast(cityName, forecast) {
    var message = "📅 " + cityName + " 天气预报\n";
    message += "━━━━━━━━━━━━━━━\n";
    message += "📍 " + forecast.province + " " + forecast.city + "\n";
    message += "🕐 发布时间: " + forecast.reporttime + "\n\n";

    var casts = forecast.casts;
    for (var i = 0; i < casts.length && i < 4; i++) {
        var day = casts[i];
        var dayIcon = getWeatherIcon(day.dayweather);
        var nightIcon = getWeatherIcon(day.nightweather);

        message += "📆 " + day.date + " " + day.week + "\n";
        message += dayIcon + " 白天: " + day.dayweather + " " + day.daytemp + "°C " + day.daywind + "风" + day.daypower + "级\n";
        message += nightIcon + " 夜间: " + day.nightweather + " " + day.nighttemp + "°C " + day.nightwind + "风" + day.nightpower + "级\n";

        if (i < casts.length - 1) {
            message += "\n";
        }
    }

    message += "\n━━━━━━━━━━━━━━━\n";
    message += "💡 发送「" + cityName + "天气」查看实时天气";

    sendText(message);
}

// 获取天气图标
function getWeatherIcon(weather) {
    if (!weather) return "🌈";

    if (weather.indexOf("晴") !== -1) return "☀️";
    if (weather.indexOf("多云") !== -1) return "⛅";
    if (weather.indexOf("阴") !== -1) return "☁️";
    if (weather.indexOf("雨") !== -1) return "🌧";
    if (weather.indexOf("雪") !== -1) return "❄️";
    if (weather.indexOf("雷") !== -1) return "⚡";
    if (weather.indexOf("雾") !== -1 || weather.indexOf("霾") !== -1) return "🌫";
    if (weather.indexOf("风") !== -1) return "💨";

    return "🌈";
}

// 显示帮助信息
function showHelp() {
    var message = "🌤 天气查询插件使用帮助\n";
    message += "━━━━━━━━━━━━━━━\n\n";
    message += "📝 使用方法:\n";
    message += "• 城市名+天气 - 查询实时天气\n";
    message += "  示例: 北京天气、朝阳区天气\n\n";
    message += "• 城市名+天气预报 - 查询未来4天天气\n";
    message += "  示例: 上海天气预报、浦东新区天气预报\n\n";
    message += "� 支持范围:\n";
    message += "✅ 全国所有省、市、区、县\n";
    message += "✅ 自动识别城市名称\n";
    message += "✅ 支持简称和全称\n\n";
    message += "💡 查询示例:\n";
    message += "• 北京天气\n";
    message += "• 海淀区天气\n";
    message += "• 上海浦东新区天气预报\n";
    message += "• 成都市天气\n";
    message += "• 西藏拉萨天气\n\n";
    message += "⚙️ 配置说明:\n";
    message += "需要在插件参数中配置:\n";
    message += "高德地图API Key (Web服务Key)\n\n";
    message += "🔑 获取API Key:\n";
    message += "访问 https://console.amap.com\n";
    message += "注册并创建应用获取Web服务Key\n\n";
    message += "━━━━━━━━━━━━━━━\n";
    message += "💡 提示: 基于高德地图API,数据准确可靠";

    sendText(message);
}

// 执行主函数
main();
