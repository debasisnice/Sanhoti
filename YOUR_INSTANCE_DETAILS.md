# Your EC2 Instance Details

**Keep this file private and do NOT commit to Git!**

## Instance Information

- **Public IPv4 Address**: `44.220.179.207`
- **Public IPv4 DNS**: `ec2-44-220-179-207.compute-1.amazonaws.com`
- **Region**: US East (N. Virginia) - `us-east-1`
- **Instance Type**: t3.micro (or t2.micro)
- **AMI**: Ubuntu Server 22.04 LTS

---

## Quick Connection Commands

### On Mac/Linux:

```bash
# Change permissions on key file (one-time)
chmod 400 ~/Downloads/sanhoti-keypair.pem

# Connect to instance
ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@44.220.179.207
```

### On Windows (PuTTY):

1. Convert `.pem` to `.ppk` using PuTTYgen (if needed)
2. Host Name: `ubuntu@44.220.179.207`
3. Load private key in Connection → SSH → Auth
4. Click "Open"

---

## Next Steps

1. ✅ **Connect to instance** (see commands above)
2. ✅ **Follow Step 3-11** in `AWS_DEPLOYMENT_GUIDE.md`
3. ✅ **Deploy your application**

---

## Test Your Website (After Deployment)

Once deployed, test at:
- **HTTP**: `http://44.220.179.207`
- **Health Check**: `http://44.220.179.207/health`

---

## Important Notes

- The IP address may change if you stop/start the instance
- Consider setting up an Elastic IP if you need a static IP
- Keep your key pair file (`sanhoti-keypair.pem`) secure and never share it

---

**Ready to deploy? Follow the deployment guide from Step 2 onwards!**

