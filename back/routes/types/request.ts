import {Request} from "express";
import {Core} from "../../core/haproxy/types";
import Config = Core.Config;

interface Body<T> extends Request {
    body: T
}

export type Save = Body<{ config: Config }>
export type Get = Save;


export type Authorization = Body<{ hash: string }>;