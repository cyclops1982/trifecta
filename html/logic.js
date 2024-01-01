"use strict";


const G_NoUser = {
    username: "",
    loggedon: false,
    login: "",
    isadmin: false
}

document.addEventListener('alpine:init', () => {
    Alpine.store('user', G_NoUser); // The user currently using the site
    Alpine.store('users', {}); // admin 
    Alpine.store('sessions', {}); // admin
    Alpine.store('imageslist', {}); // List of images (both admin and your own)
    Alpine.store('post', {
        id: undefined,
        canTouch: false,
    }); // current post
})



function ShowMessage(msg, error) {
    // we might as well move to setting the innerHTML here, but we'll leave this for now
    Alpine.store("message2user", msg);
    const span = document.querySelector("#userfeedback > span");
    span.classList.remove("error")

    if (error !== undefined) {
        span.classList.add("error")
        console.error(error);
    }
}


async function getLoginStatus() {
    console.log("getLoginStatus");
    const response = await fetch('status');
    const result = await response.json();
    if (result.login) {
        Alpine.store('user', {
            username: result.user,
            login: "Logged in as user " + result.user,
            loggedon: true,
            isadmin: result.admin,
        });
    }
}

async function LoadPost(postid = undefined) {
    console.log(`LoadPost(${postid})`);
    if (postid === undefined) {
        let url = new URL(window.location.href)
        postid = url.searchParams.get("p");
    }
    if (postid !== undefined && postid != null) {
        const data = await (await fetch(`getPost/${postid}`)).json();
        const touchData = await (await fetch(`can_touch_post/${postid}`)).json();
        let canTouch = false;
        if (touchData) {
            canTouch = touchData.can_touch_post;
        }
        if (data && touchData) {
            console.log(data);
            let hasExpired = false;
            if (data.publicUntil > 0) {
                hasExpired = (data.publicUntil*1000) < Date.now();
            }
            Alpine.store('post', {
                id: postid,
                images: data.images,
                title: data.title,
                public: data.public,
                publicUntil: data.publicUntil,
                publicExpired: hasExpired,
                canTouch: canTouch
            })
        }
    } else {
        console.log("No loading post, as there's no postid.");
    }
}

async function LoadPage() {
    await getLoginStatus();
    LoadPost();
    if (Alpine.store('user').isadmin) {
        getUserList();
        getSessionList();
    }
    getImageList();
}

function doLogout() {
    fetch("logout", { method: "POST" })
        .then(function (res) {
            Alpine.store('user', G_NoUser);
        });
}

function getImageList(f) {
    fetch('all-images').then(response => response.json()).then(data => {
        Alpine.store('imageslist', data)
    });
}
function getUserList() {
    fetch('all-users').then(response => response.json()).then(data => {
        Alpine.store('users', data)
    });
}

function getSessionList() {
    fetch('all-sessions').then(response => response.json()).then(data => {
        Alpine.store('sessions', data)
    });
}


function getMyImageList(f) {
    fetch('my-images').then(response => response.json()).then(data => {
        Alpine.store('imageslist', data)
    });
}

function doSetPostTitle(postid, el) {
    const formData = new FormData();
    formData.append('title', el.value);

    fetch(`set-post-title/${postid}`, { method: "POST", body: formData });
}

function doLogin(el) {
    const data = new FormData(el);
    fetch("login", { method: "POST", body: data })
        .then(response => response.json()).then(data => {
            if (data.ok) {
                LoadPage();
            }
            else {
                ShowMessage(data.message, data);
            }
        });
}

function doDeleteImage(imageid) {
    if (window.confirm("Do you really want to delete this image?")) {
        fetch(`delete-image/${imageid}`, { method: "POST" })
            .then(function (res) {
                if (res.ok) {
                    getMyImageList();
                    LoadPost();
                }
            });
    }
}

function doDeletePost(postid) {
    if (window.confirm("Do you really want to delete this post?")) {
        fetch(`delete-post/${postid}`, { method: "POST" })
            .then(function (res) {
                if (res.ok) {
                    window.location.href = "./";
                }
            });
    }
}

function doKillSession(sessionid) {
    fetch(`kill-session/${sessionid}`, { method: "POST" }).then(function (res) {
        if (res.ok) {
            getSessionList();
        }
    });
}

function doDelUser(user) {
    if (window.confirm("Do you really want to delete this user?")) {
        fetch(`del-user/${user}`, { method: "POST" }).then(function (res) {
            if (res.ok) {
                getUserList();
            }
        });
    }
}


function doChangePublic(postid, el) {
    let val = el.checked ? "1" : "0";
    el.disabled = true; // disable while transaction is running

    fetch(`set-post-public/${postid}/${val}`, { method: "POST" }).then(function (res) {
        el.disabled = false;

        if (res.ok) {
            el.checked = !el.checked;
            LoadPost();
        }
    });
}

function doChangePublicUntil(postid, postpublic, seconds) {
    let limit = (Date.now() / 1000 + seconds).toFixed();
    if (seconds == 0) {
        limit = 0;
    }
    fetch(`set-post-public/${postid}/${postpublic}/${limit}`, { method: "POST" }).then(function (res) {
        if (res.ok) {
            LoadPost();
        }
    });
}

function doChangeUserDisabled(f, user, el) {
    let val = el.checked ? "1" : "0";
    el.disabled = true; // disable while transaction is running

    fetch(`change-user-disabled/${user}/${val}`, { method: "POST" }).then(function (res) {
        el.disabled = false;

        if (res.ok) {
            getUserList();
        } else {
            ShowMessage("Failed to enable/disable user", res);
        }
    });
}


function processCaptionKey(value, imageid) {
    const formData = new FormData();
    formData.append('caption', value);

    fetch(`set-image-caption/${imageid}`, { method: "POST", body: formData });
    //TODO: error handling
}

async function uploadFile(clipboardItem, postid = undefined) {
    if (clipboardItem.type.startsWith('image/')) {
        const formData = new FormData();
        if (postid !== undefined) {
            console.log(`Passing known postId: ${postid}`);
            formData.append('postId', postid);
        }

        formData.append('file', clipboardItem, clipboardItem.name);
        const response = await fetch("upload", {
            method: 'POST',
            body: formData
        });

        console.log(formData);
        if (response.ok) {
            const data = await response.json();
            const url = new URL(window.location.href);
            url.searchParams.set("p", data.postId);
            history.pushState({}, "", url);
            return data.postId;
        } else {
            console.error('Error uploading file:', response.statusText);
        }
    }
    else {
        console.log("Don't know how to deal with paste of " + clipboardItem.type);
    }
}

// this uploads an image, possibly to an existing post. If there is no post yet, it receives
// the post that was created for us
async function getImageFromPaste(e) {
    e.preventDefault();
    if (!Alpine.store('user').loggedon) {

        ShowMessage("Please login to paste an image.");
        return;
    }

    let postid = Alpine.store('post').id;

    let files = e.clipboardData.files;
    if (files.length > 0) {
        postid = await uploadFile(files[0], postid);
        for (let n = 1; n < files.length; ++n) {
            uploadFile(files[n], postid);
        }
        LoadPost(postid);
    } else {
        console.log("Clipboard data is not a file");
    }
}

async function processDrop(e) {
    if (!Alpine.store('user').loggedon) {
        ShowMessage("Please login to paste an image.");
        return;
    }

    let postid = Alpine.store('post').id;

    let files = e.dataTransfer.files;
    if (files.length > 0) {
        postid = await uploadFile(files[0], postid);
        for (let n = 1; n < files.length; ++n) {
            uploadFile(files[n], postid);
        }
        LoadPost(postid);
    }
}

function doCreateUser(el) {
    let user = el[0].value;
    let pass1 = el[1].value;
    let pass2 = el[2].value;
    if (pass1 != pass2) {
        Alpine.store('createusermessage', "Passwords do not match");
        return;
    }

    fetch("create-user", { method: "POST", body: new FormData(el) }).then(response => {
        if (response.ok) {
            response.json().then(data => {
                if (data.ok) {
                    Alpine.store('createusermessage', "User created");
                    getUserList();
                }
                else {
                    Alpine.store('createusermessage', data.message);
                }
            });
        }
        else {
            Alpine.store('createusermessage', "Unexpected error in create-user");
            console.error(response);

        }

    });
}
