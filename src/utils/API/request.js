import axios from "axios";

const gratisInstance = axios.create({
	baseURL: "https://api.apigratis.tech",
});
gratisInstance.defaults.validateStatus = () => true;

function makeClient(instance) {
	return {
		async get(path, params, options) {
			return instance
				.get(path, { params, ...options })
				.catch((e) => e?.response);
		},
		async post(path, data, options) {
			return instance.post(path, data, options).catch((e) => e?.response);
		},
		async request(options) {
			return instance.request({ ...options }).catch((e) => e?.response);
		},
	};
}

export const Gratis = makeClient(gratisInstance);

export const APIRequest = {
	Gratis,
};
