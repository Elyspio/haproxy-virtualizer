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
    const data: { name: string, data: Core.Frontend } = JSON.parse(JSON.stringify(props.data))
    const {name, data: frontend} = data;

    const updateData = () => dispatch(frontendActions.update(data))
    const remove = () => dispatch(frontendActions.remove(name))

    return {
        update: {
            mode: (val: Core.Mode) => {
                frontend.mode = val;
                updateData();
            },
            name: (val: string) => {
                remove()
                dispatch(frontendActions.update({name: val, data: frontend}));
            },
            host: (val: string) => {
                frontend.bind.host = val;
                updateData();
            },
            port: (val: number) => {
                frontend.bind.port = val;
                updateData();
            },
            backend: {
                create: () => {
                    if (frontend.backends.find(x => x.name === "")) return;
                    frontend.backends.push({name: "", condition: undefined})
                    updateData();
                },

                remove: (index: number) => {
                    frontend.backends = [
                        ...frontend.backends.slice(0, index),
                        ...frontend.backends.slice(index + 1),
                    ]
                    updateData()
                },

                name: (index: number, next: string) => {

                    const currentBackend = frontend.backends[index];
                    currentBackend.name = next;
                    updateData()
                },

                condition: (index: number, val: string) => {
                    const currentBackend = frontend.backends[index];
                    currentBackend.condition = val.length ? val : undefined;
                    updateData();
                }
            }
        },
        remove: () => remove()
    }
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
        <Paper className="Frontend" variant={"outlined"} >
            <Grid container spacing={4} direction={"row"} className={"header"}>
                <Grid item xs={3}>
                    <TextField
                        id={"front-name-" + name}
                        label="Name"
                        value={name}
                        className={"name"}
                        onChange={e => props.update.name(e.target.value)}/>
                </Grid>


                <Grid item xs={2}>
                    <TextField
                        id={"front-host-" + name}
                        label="Host"
                        value={bind.host}
                        onChange={e => props.update.host(e.target.value)}/>
                </Grid>

                <Grid item xs={2}>
                    <TextField
                        id={"front-port-" + name}
                        label="Port"
                        value={bind.port}
                        type={"number"}
                        onChange={e => props.update.port(Number.parseInt(e.target.value))}/>
                </Grid>


                <Grid item xs={1}>
                    <InputLabel className={"select-label"} id={"select-mode-" + name}>Mode</InputLabel>
                    <Select
                        labelId={"front-select-mode-" + name}
                        value={mode}
                        onChange={(e) => props.update.mode(e.target.value as Core.Mode)}
                    >
                        <MenuItem value={"http"}>HTTP</MenuItem>
                        <MenuItem value={"tcp"}>TCP</MenuItem>
                    </Select>
                </Grid>

                <Grid item xs={2}/>


                <Grid item xs={3}>
                    <Button color={"secondary"} className={"create-btn"} onClick={props.update.backend.create}>Use backend<Add/></Button>
                </Grid>
                <Grid item xs={9}>
                    {backends.map((b, i) =>
                        <div key={i} className={"backend"}>
                            <div className="backend-name">
                                <InputLabel className={"select-label"} id={`select-backend-${name}-${i}`}>Backend</InputLabel>
                                <Select
                                    labelId={`front-select-backend-${name}-${i}`}
                                    value={b.name}
                                    onChange={(e) => props.update.backend.name(i, e.target.value as string)}
                                >
                                    {storeBackends.map((sb, i) => <MenuItem key={i} value={sb.name}>{sb.name}</MenuItem>)}
                                </Select>

                            </div>
                            <TextField
                                id={`condition-${name}-${i}`}
                                label="Condition"
                                value={b.condition}
                                onChange={e => props.update.backend.condition(i, e.target.value)}/>

                            <IconButton className={"remove-backend-btn"} onClick={() => props.update.backend.remove(i)}>
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
