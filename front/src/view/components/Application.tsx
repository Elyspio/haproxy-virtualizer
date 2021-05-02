import * as React from 'react';
import {Paper} from "@material-ui/core";
import "./Application.scss"
import {toggleTheme} from "../../store/module/theme/action";
import Appbar from "./appbar/Appbar";
import Brightness5Icon from '@material-ui/icons/Brightness5';
import Haproxy from "./haproxy/Haproxy";
import {Drawer} from "./utils/drawer/Drawer";
import {useAppDispatch} from "../../store";


function Application() {

    const dispatch = useAppDispatch();
    const toggle = React.useCallback(() => {
        dispatch(toggleTheme())
    }, [dispatch])

    return (
        <Paper square={true} className={"Application"}>
            <Drawer position={"right"}
                    actions={[{onClick: toggle, text: "Switch lights", icon: <Brightness5Icon/>}]}>
                <div className="content">
                    <Appbar appName={"HAProxy"}/>
                    <Haproxy/>
                </div>
            </Drawer>
        </Paper>
    );
}

export default Application
