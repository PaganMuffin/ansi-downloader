const { default: axios } = require("axios");
const cheerio = require("cheerio");
const FormData = require("form-data");
const fd = require("fs");
const fetchANSI = (page = 0) => {
	return axios(
		`http://animesub.info/szukaj.php?pOd1=1&pOd2=1&pOd3=2000&pSortuj=datad&od=${page}`,
		{
			headers: {
				accept:
					"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
				"accept-language": "pl-PL,pl;q=0.9",
				"cache-control": "no-cache",
				pragma: "no-cache",
				"upgrade-insecure-requests": "1",
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36",
			},
			referrerPolicy: "strict-origin-when-cross-origin",
			body: null,
			method: "GET",
			credentials: "include",
		}
	);
};

const writeToLog = (log, text) => {
	fd.appendFileSync(log, `[${new Date().toISOString()}] ` + text + "\n");
};

(async () => {
	//create folder subs and info
	if (!fd.existsSync("./subs")) fd.mkdirSync("./subs");

	if (!fd.existsSync("./info")) fd.mkdirSync("./info");

	const logFile = `./[${new Date().toISOString()}]_log.txt`;

	//create log file
	if (!fd.existsSync(logFile)) fd.writeFileSync(logFile, "");

	let start = 0;
	let end = -1;
	const args = process.argv.slice(2);
	if (args.length < 1) {
		console.log("Usage: node app.js <file>");
		process.exit(1);
	} else if (args[0] == "all") {
		const selectorLastPage =
			"body > center > table > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr > td:nth-child(3) > div:nth-child(12) > table > tbody > tr > td:nth-child(3) > a";
		const f = await fetchANSI();
		const html = f.data;
		const $ = cheerio.load(html);

		start = 0;
		end = parseInt($(selectorLastPage).text().slice(2));
	} else if (args.length == 1) {
		start = parseInt(args[0]) - 1;
		end = start + 1;
	} else if (args.length == 2) {
		start = parseInt(args[0]) - 1;
		end = parseInt(args[1]) - 1;
	}
	let ansiSciagnij = null;
	for (let i = start; i <= end; i++) {
		console.log(`Strona ${i + 1}`);
		writeToLog(logFile, `Strona ${i + 1}`);
		const f = await fetchANSI(i);
		const html = f.data;
		if (ansiSciagnij == null) {
			const cookies = f.headers["set-cookie"];
			const getCookie = (name) => {
				const value = cookies.find((c) => c.startsWith(name));
				return value ? value.split(";")[0].split("=")[1] : null;
			};
			ansiSciagnij = getCookie("ansi_sciagnij");
		}
		const $ = cheerio.load(html);
		const selector = `body > center > table > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr > td:nth-child(3) > table.Napisy`;

		const axiosPromise = [];

		$(selector).each(async (i, el) => {
			if (el.name == "table" && el.attribs.style == "text-align:center") {
				const firstRow = [];
				const secondRow = [];
				const thirdRow = [];
				const fourthRow = [];

				//Zwiniecie
				if (true) {
					el?.children[1]?.children[0]?.children
						.filter((c) => c.name == "td")
						.map((x) => {
							firstRow.push(x?.children[0]?.data);
						});

					el?.children[1]?.children[2]?.children
						.filter((c) => c.name == "td")
						.map((x) => {
							if (x?.children[0]?.name == "a") {
								const a = {
									id: x?.children[0]?.attribs.href.split("id=")[1],
									nick: x?.children[0]?.children[0]?.data.slice(1),
								};
								secondRow.push(a);
							} else {
								secondRow.push(x?.children[0]?.data);
							}
						});

					el?.children[1]?.children[4]?.children
						.filter((c) => c.name == "td")
						.map((x) => {
							thirdRow.push(x?.children[0]?.data);
						});

					el?.children[1]?.children[6]?.children
						.filter((c) => c.name == "td")
						.map((x) => {
							const f = {
								id: "",
								sh: "",
							};
							if (x.children[1]?.name == "form") {
								const f = {
									id: x.children[1]?.children[1]?.attribs.value,
									sh: x.children[1]?.children[2]?.attribs.value,
								};
								fourthRow.push(f);
							}
						});
				}

				const info = {
					title: {
						romaji: firstRow[0],
						english: secondRow[0],
						other: thirdRow[0],
					},
					date: firstRow[1],
					author: secondRow[1],
					id: fourthRow[0].id,
				};

				fd.writeFileSync(`./info/${info.id}.json`, JSON.stringify(info));

				console.log(`Pobieranie ID: ${info.id}`);
				writeToLog(logFile, `Pobieranie ID: ${info.id}`);

				axiosPromise.push(
					axios({
						method: "post",
						url: `http://animesub.info/sciagnij.php`,
						data: `id=${fourthRow[0].id}&sh=${fourthRow[0].sh}&single_file=Pobierz+napisy`,
						headers: {
							Accept:
								"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
							"Accept-Language": "pl-PL,pl;q=0.9",
							"Cache-Control": "no-cache",
							"Content-Type": "application/x-www-form-urlencoded",
							"User-Agent":
								"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36",
							Cookie: `ansi_sciagnij=${ansiSciagnij}`,
						},
						credentials: "include",
						withCredentials: true,
						responseType: "stream",
					}).then((response) => {
						if (response.headers["content-type"] == "application/zip") {
							const filename =
								response.headers["content-disposition"].split("filename=")[1];
							const writer = fd.createWriteStream(
								`./subs/[${info.id}]_${filename}.zip`
							);
							return new Promise((resolve, reject) => {
								response.data.pipe(writer);
								let error = null;
								writer.on("error", (err) => {
									error = err;
									writer.close();
									reject(err);
								});
								writer.on("close", () => {
									console.log("Pobrano ID: " + info.id);
									writeToLog(logFile, "Pobrano ID: " + info.id);
									if (!error) {
										resolve(true);
									}
								});
							});
						} else {
							console.log(`Błąd pobierania ID: ${info.id}`);
							writeToLog(logFile, `Błąd pobierania ID: ${info.id}`);
						}
					})
				);
			}
		});

		await Promise.all(axiosPromise);
		ansiSciagnij = null;
	}

	console.log("Koniec");
	writeToLog(logFile, "Koniec");
})();
