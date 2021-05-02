import React, {Component} from 'react';
import {Dispatch} from "redux";
import {connect, ConnectedProps} from "react-redux";
import {setConfig} from "../../../store/module/haproxy/action";
import {Haproxy as IHaproxy} from "../../../../../back/src/controllers/haproxy/types";
import FrontendContainer from "./frontend/container/FrontendContainer";
import BackendContainer from "./backend/BackendContainer";
import {Button, ButtonGroup, Container} from "@material-ui/core";
import "./Haproxy.scss"
import {Services} from "../../../core/services";
import {StoreState} from "../../../store";

const mapStateToProps = (state: StoreState) => ({config: state.haproxy.config})

const mapDispatchToProps = (dispatch: Dispatch) => ({setConfig: (conf: IHaproxy.Config) => dispatch(setConfig(conf))})

const connector = connect(mapStateToProps, mapDispatchToProps);
type ReduxTypes = ConnectedProps<typeof connector>;


class Haproxy extends Component<ReduxTypes> {

    async componentDidMount() {
        const conf = await Services.haproxy.getConfig();
        this.props.setConfig(conf as any);
    }

    render() {
        return (
            <Container className={"Haproxy"}>
                <FrontendContainer/>
                <BackendContainer/>

                <ButtonGroup variant={"contained"}>
                    <Button color={"secondary"} className={"action-btn"} variant={"outlined"}
                            onClick={this.download}>Download</Button>
                    <Button color={"secondary"} className={"action-btn"} variant={"outlined"}>Upload</Button>
                </ButtonGroup>
            </Container>
        );
    }

    private download = () => Services.haproxy.download(this.props.config);

    private save = () => Services.haproxy.setConfig(this.props.config);
}


export default connector(Haproxy);
