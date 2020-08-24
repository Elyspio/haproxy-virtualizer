import React from 'react';
import {Core} from "../../../../../back/core/haproxy/types";
import {Button, Grid, IconButton, InputLabel, MenuItem, Paper, Select, TextField} from "@material-ui/core";
import {connect, ConnectedProps} from "react-redux";
import {RootState} from "../../../store/reducer";
import {Dispatch} from "redux";
import {frontendActions} from "../../../store/module/haproxy/action";
import './Frontend.scss'
import CloseIcon from '@material-ui/icons/Close';
import {Add} from "@material-ui/icons";

const mapStateToProps = (state: RootState) => ({backends: state.haproxy.config?.backends})

const mapDispatchToProps = (dispatch: Dispatch, props: Props) => {
    const data = props.data;
    const frontend = data.data;
    const name = data.name;
    return ({
        update: {
            mode: (val: Core.Mode) => {
                dispatch(frontendActions.update({...data, data: {...frontend, mode: val}}))
            },
            name: (val: string) => {
                dispatch(frontendActions.remove(data.name));
                dispatch(frontendActions.update({name: val, data: frontend}));
            },
            host: (val: string) => {
                dispatch(frontendActions.update({
                    ...data, data: {
                        ...frontend, bind: {
                            ...frontend.bind,
                            host: val
                        }
                    }
                }))
            },
            port: (val: number) => {
                dispatch(frontendActions.update({
                    ...data, data: {
                        ...frontend, bind: {
                            ...frontend.bind,
                            port: val
                        }
                    }
                }))
            },
            backend: {

                create: () => {

                    if (frontend.backends.find(x => x.name === "")) return;

                    dispatch(frontendActions.update({
                        ...data, data: {
                            ...frontend,
                            backends: [
                                ...frontend.backends,
                                {name: "", condition: undefined}
                            ]
                        }
                    }));
                },

                remove: (backendName: string) => {

                    const backends = frontend.backends.filter(b => b.condition !== backendName);

                    dispatch(frontendActions.update({
                        ...data, data: {
                            ...frontend,
                            backends
                        }
                    }));
                },

                name: (old: string, next: string) => {
                    const currentBackend = frontend.backends.find(b => b.name === old);

                    if (!currentBackend) throw new Error(`Could not find backend with name=${old} in frontent with name=${name}`)

                    const backends = frontend.backends.filter(b => b.name !== old);
                    backends.push({name: next, condition: currentBackend.condition})

                    dispatch(frontendActions.update({
                        ...data, data: {
                            ...frontend,
                            backends
                        }
                    }));
                },

                condition: (backendName: string, val: string) => {
                    const currentIndex = frontend.backends.findIndex(b => b.name === backendName);
                    if (currentIndex === -1) throw new Error(`Could not find backend with name=${backendName} in frontent with name=${name}`)

                    const backends = [
                        ...frontend.backends.slice(0, currentIndex),
                        {
                            name: backendName,
                            condition: val
                        },
                        ...frontend.backends.slice(currentIndex + 1)
                    ];
                    dispatch(frontendActions.update({
                        ...data, data: {
                            ...frontend,
                            backends
                        }
                    }));
                }
            }
        },
        remove: () => {
            dispatch(frontendActions.remove(name))
        }
    });
}

const connector = connect(mapStateToProps, mapDispatchToProps);
type ReduxTypes = ConnectedProps<typeof connector>;

interface Props {
    data: {
        name: string,
        data: Core.Frontend
    }
}

function Frontend(props: Props & ReduxTypes) {
    const {data: {data: {mode, backends, bind}, name}} = props;

    const storeBackends = Object.entries(props.backends).map(([name, backend]) => ({name, data: backend}))

    return (
        <Paper className="Frontend">
            <Grid container spacing={4} direction={"row"} className={"header"}>
                <Grid item xs={4}>
                    <TextField
                        id={"name-" + name}
                        label="Name"
                        value={name}
                        className={"name"}
                        onChange={e => props.update.name(e.target.value)}/>
                </Grid>


                <Grid item xs={3}>
                    <TextField
                        id={"host-" + name}
                        label="Host"
                        value={bind.host}
                        onChange={e => props.update.host(e.target.value)}/>
                </Grid>

                <Grid item xs={2}>
                    <TextField
                        id={"port-" + name}
                        label="Port"
                        value={bind.port}
                        type={"number"}
                        onChange={e => props.update.port(Number.parseInt(e.target.value))}/>
                </Grid>


                <Grid item xs={3}>
                    <InputLabel className={"select-label"} id={"select-mode-" + name}>Mode</InputLabel>
                    <Select
                        labelId={"select-mode-" + name}
                        id="demo-simple-select"
                        value={mode}
                        onChange={(e) => props.update.mode(e.target.value as Core.Mode)}
                    >
                        <MenuItem value={"http"}>HTTP</MenuItem>
                        <MenuItem value={"tcp"}>TCP</MenuItem>
                    </Select>
                </Grid>


                <Grid item xs={4}>
                    <Button  color={"secondary"} className={"create-btn"} onClick={props.update.backend.create}>Add backend<Add/></Button>
                </Grid>
                <Grid item xs>
                    {backends.map((b, i) =>
                        <div key={i} className={"backend"}>
                            <div className="backend-name">
                                <InputLabel className={"select-label"} id={`select-backend-${name}-${i}`}>Backend</InputLabel>
                                <Select
                                    labelId={`select-backend-${name}-${i}`}
                                    value={b.name}
                                    onChange={(e) => props.update.backend.name(b.name, e.target.value as string)}
                                >
                                    {storeBackends.filter(sb => !props.data.data.backends.map(b => b.name).includes(sb.name) || sb.name === b.name).map(sb => <MenuItem value={sb.name}>{sb.name}</MenuItem>)}
                                </Select>

                            </div>
                            <TextField
                                id={`condition-${name}-${i}`}
                                label="Condition"
                                value={b.condition}
                                onChange={e => props.update.backend.condition(b.name, e.target.value)}/>

                            <IconButton className={"remove-backend-btn"} onClick={() => props.update.backend.remove(b.condition as string)}>
                                <CloseIcon fontSize={"small"}/>
                            </IconButton>


                        </div>
                    )}
                </Grid>


            </Grid>

            <IconButton className={"close-btn"} onClick={props.remove}><CloseIcon/></IconButton>
        </Paper>
    );
}

export default connector(Frontend);
