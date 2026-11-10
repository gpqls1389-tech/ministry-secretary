// /api/* 요청을 모두 이 파일이 받는다(Cloudflare Pages Functions). 실제 처리는 _lib/handler.js
import { handle } from '../_lib/handler.js';
export const onRequest = ({ request, env }) => handle(request, env);
