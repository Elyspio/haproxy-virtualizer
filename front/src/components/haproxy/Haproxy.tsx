import React, {Component} from 'react';
import {RootState} from "../../store/reducer";
import {Dispatch} from "redux";
import {connect, ConnectedProps} from "react-redux";
import {setConfig} from "../../store/module/haproxy/action";
import {Haproxy as IHaproxy} from "../../../../back/src/controllers/haproxy/types";
import {HaproxyApi} from "../../api/haproxy";
import FrontendContainer from "./frontend/container/FrontendContainer";
import BackendContainer from "./backend/BackendContainer";
import {Button, ButtonGroup, Container} from "@material-ui/core";
import "./Haproxy.scss"

const mapStateToProps = (state: RootState) => ({config: state.haproxy.config})

const mapDispatchToProps = (dispatch: Dispatch) => ({setConfig: (conf: IHaproxy.Config) => dispatch(setConfig(conf))})

const connector = connect(mapStateToProps, mapDispatchToProps);
type ReduxTypes = ConnectedProps<typeof connector>;


class Haproxy extends Component<ReduxTypes> {

    async componentDidMount() {
        const conf = await HaproxyApi.instance.getConfig();
        this.props.setConfig(conf);
    }

    render() {
        return (
            <Container className={"Haproxy"}>
                <FrontendContainer/>
                <BackendContainer/>

                <ButtonGroup variant={"contained"}>
                    <Button color={"secondary"} className={"action-btn"} variant={"outlined"} onClick={this.download}>Download</Button>
                    <Button color={"secondary"} className={"action-btn"} variant={"outlined"}>Upload</Button>
                </ButtonGroup>
            </Container>
        );
    }

    private download = () => HaproxyApi.instance.download(this.props.config);

    private save = () => HaproxyApi.instance.setConfig(this.props.config);
}


export default connector(Haproxy);
